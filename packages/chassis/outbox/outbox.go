package outbox

import (
	"context"
	"fmt"
	"log/slog"
	"regexp"
	"sync"
	"time"

	"github.com/ThreeDotsLabs/watermill"
	"github.com/ThreeDotsLabs/watermill-sql/v4/pkg/sql"
	"github.com/ThreeDotsLabs/watermill/components/forwarder"
	"github.com/ThreeDotsLabs/watermill/message"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/Bending-Forks/gotion/packages/chassis/event"
)

// Schema creates the tables of the outbox, the standard PostgreSQL schema of watermill-sql: the events, and the offset up to which the Forwarder has sent them.
// A service that publishes events puts it in one of its migrations.
const Schema = `CREATE TABLE "watermill_outbox" (
	"offset" BIGSERIAL,
	"uuid" VARCHAR(36) NOT NULL,
	"created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"payload" JSON DEFAULT NULL,
	"metadata" JSON DEFAULT NULL,
	"transaction_id" xid8 NOT NULL,
	PRIMARY KEY ("transaction_id", "offset")
);
CREATE TABLE "watermill_offsets_outbox" (
	consumer_group VARCHAR(255) NOT NULL,
	offset_acked BIGINT,
	last_processed_transaction_id xid8 NOT NULL,
	PRIMARY KEY (consumer_group)
);
`

const (
	// outboxTopic names the tables of Schema.
	outboxTopic = "outbox"
	// group is the consumer group of the Forwarder in the offsets table; its row is the lock that lets one replica at a time send.
	group = "forwarder"
	// pollInterval stays well within the 5 s (p99) between a change and its effect in another service.
	pollInterval = 500 * time.Millisecond
	// retryConnect is the wait before connecting again to a Kafka that did not answer.
	retryConnect = 5 * time.Second
	measureEvery = 5 * time.Second
	cleanupEvery = time.Hour
	// keepSent is how long after it was written a row, once sent, stays in the outbox, to look into what was published.
	keepSent = 24 * time.Hour
)

var schemaAdapter = sql.DefaultPostgreSQLSchema{}

// kafkaTopic is a name that Kafka accepts for a topic.
var kafkaTopic = regexp.MustCompile(`^[a-zA-Z0-9._-]{1,249}$`)

func subscriberConfig() sql.SubscriberConfig {
	return sql.SubscriberConfig{
		ConsumerGroup:  group,
		PollInterval:   pollInterval,
		SchemaAdapter:  schemaAdapter,
		OffsetsAdapter: sql.DefaultPostgreSQLOffsetsAdapter{},
	}
}

// Publish writes events into the outbox inside tx, the transaction of the change that raised them, to be sent to the Kafka topic.
func Publish(ctx context.Context, tx pgx.Tx, topic string, events ...event.EventEnvelope) error {
	if len(events) == 0 {
		return nil
	}
	// A row Kafka refuses would hold up every row after it.
	if !kafkaTopic.MatchString(topic) || topic == "." || topic == ".." {
		return fmt.Errorf("%q is not a name Kafka accepts for a topic", topic)
	}
	messages := make([]*message.Message, 0, len(events))
	for _, e := range events {
		msg, err := event.NewMessage(ctx, e)
		if err != nil {
			return err
		}
		messages = append(messages, msg)
	}
	publisher, err := sql.NewPublisher(sql.TxFromPgx(tx), sql.PublisherConfig{SchemaAdapter: schemaAdapter}, nil)
	if err != nil {
		return fmt.Errorf("create the publisher of the outbox: %w", err)
	}
	if err := forwarder.NewPublisher(publisher, forwarder.PublisherConfig{ForwarderTopic: outboxTopic}).Publish(topic, messages...); err != nil {
		return fmt.Errorf("write %d events into the outbox: %w", len(events), err)
	}
	return nil
}

// Forwarder sends the events of the outbox to Kafka, deletes the rows sent long ago, and measures the rows still to send.
type Forwarder struct {
	pool    *pgxpool.Pool
	connect func() (message.Publisher, error)
	logger  *slog.Logger
	pending prometheus.Gauge
	oldest  prometheus.Gauge
}

// NewForwarder returns the Forwarder of the outbox in the database of pool and registers its metrics.
func NewForwarder(pool *pgxpool.Pool, brokers []string, logger *slog.Logger, registry prometheus.Registerer) (*Forwarder, error) {
	return newForwarder(pool, func() (message.Publisher, error) { return event.NewPublisher(brokers, logger) }, logger, registry)
}

func newForwarder(pool *pgxpool.Pool, connect func() (message.Publisher, error), logger *slog.Logger, registry prometheus.Registerer) (*Forwarder, error) {
	f := &Forwarder{
		pool:    pool,
		connect: connect,
		logger:  logger,
		pending: prometheus.NewGauge(prometheus.GaugeOpts{
			Name: "outbox_pending_events",
			Help: "Events in the outbox not yet sent to Kafka.",
		}),
		oldest: prometheus.NewGauge(prometheus.GaugeOpts{
			Name: "outbox_oldest_pending_event_age_seconds",
			Help: "Age of the oldest event in the outbox not yet sent to Kafka, 0 when none is pending.",
		}),
	}
	for _, c := range []prometheus.Collector{f.pending, f.oldest} {
		if err := registry.Register(c); err != nil {
			return nil, fmt.Errorf("register the metrics of the outbox: %w", err)
		}
	}
	return f, nil
}

// Run sends the events to Kafka until ctx is cancelled. Only one replica at a time sends; the others wait for its lock.
// While Kafka does not answer, the events wait in the outbox and Run keeps trying to connect.
func (f *Forwarder) Run(ctx context.Context) error {
	ctx, cancel := context.WithCancel(ctx)
	var wg sync.WaitGroup
	wg.Go(func() { f.maintain(ctx) })
	err := f.forward(ctx)
	cancel()
	wg.Wait()
	return err
}

func (f *Forwarder) forward(ctx context.Context) error {
	var publisher message.Publisher
	for {
		var err error
		if publisher, err = f.connect(); err == nil {
			break
		}
		f.logger.WarnContext(ctx, "Kafka does not answer, the events wait in the outbox", "err", err)
		select {
		case <-ctx.Done():
			return nil
		case <-time.After(retryConnect):
		}
	}
	defer func() { _ = publisher.Close() }()
	logger := watermill.NewSlogLogger(f.logger)
	subscriber, err := sql.NewSubscriber(sql.BeginnerFromPgx(f.pool), subscriberConfig(), logger)
	if err != nil {
		return fmt.Errorf("create the subscriber of the outbox: %w", err)
	}
	defer func() { _ = subscriber.Close() }()
	fwd, err := forwarder.NewForwarder(subscriber, publisher, logger, forwarder.Config{ForwarderTopic: outboxTopic})
	if err != nil {
		return fmt.Errorf("create the Forwarder of the outbox: %w", err)
	}
	// Stopped while it subscribes, the router fails on the cancelled context: that is a stop, not an error.
	if err := fwd.Run(ctx); err != nil && ctx.Err() == nil {
		return fmt.Errorf("run the Forwarder of the outbox: %w", err)
	}
	return nil
}

// maintain measures the pending rows and deletes the old sent ones until ctx is cancelled.
func (f *Forwarder) maintain(ctx context.Context) {
	measure, cleanup := time.NewTicker(measureEvery), time.NewTicker(cleanupEvery)
	defer measure.Stop()
	defer cleanup.Stop()
	for {
		if err := f.measure(ctx); err != nil && ctx.Err() == nil {
			f.logger.WarnContext(ctx, "measure the outbox", "err", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-measure.C:
		case <-cleanup.C:
			if err := f.deleteSent(ctx, keepSent); err != nil && ctx.Err() == nil {
				f.logger.WarnContext(ctx, "delete the sent rows of the outbox", "err", err)
			}
		}
	}
}

// A row is sent once the offset of the Forwarder has passed it: its transaction is older than the last one sent, or it is that transaction's and its offset is not after the last one sent.
// Before the Forwarder first connects there is no offset, and every row is pending.

func (f *Forwarder) measure(ctx context.Context) error {
	var pending int64
	var age float64
	err := f.pool.QueryRow(ctx, `SELECT count(*), coalesce(extract(epoch FROM LOCALTIMESTAMP - min(m.created_at)), 0)::float8
		FROM watermill_outbox m LEFT JOIN watermill_offsets_outbox o ON o.consumer_group = $1
		WHERE o.consumer_group IS NULL
			OR m.transaction_id > o.last_processed_transaction_id
			OR (m.transaction_id = o.last_processed_transaction_id AND m."offset" > o.offset_acked)`, group).Scan(&pending, &age)
	if err != nil {
		return fmt.Errorf("count the pending rows of the outbox: %w", err)
	}
	f.pending.Set(float64(pending))
	f.oldest.Set(age)
	return nil
}

func (f *Forwarder) deleteSent(ctx context.Context, olderThan time.Duration) error {
	_, err := f.pool.Exec(ctx, `DELETE FROM watermill_outbox m USING watermill_offsets_outbox o
		WHERE o.consumer_group = $1
			AND (m.transaction_id < o.last_processed_transaction_id
				OR (m.transaction_id = o.last_processed_transaction_id AND m."offset" <= o.offset_acked))
			AND m.created_at < LOCALTIMESTAMP - $2::interval`, group, olderThan)
	if err != nil {
		return fmt.Errorf("delete the sent rows of the outbox: %w", err)
	}
	return nil
}
