package consumer

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/IBM/sarama"
	"github.com/ThreeDotsLabs/watermill"
	"github.com/ThreeDotsLabs/watermill-kafka/v3/pkg/kafka"
	"github.com/ThreeDotsLabs/watermill/message"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Bending-Forks/gotion/packages/chassis/event"
)

// Schema creates the table of the events a service has applied. A service that consumes events puts it in one of its migrations.
const Schema = `CREATE TABLE applied_events (
	event_id text PRIMARY KEY,
	applied_at timestamptz NOT NULL DEFAULT now()
);
`

// Handler applies one event in tx, the transaction in which the router records the event as applied.
// An error rolls the transaction back, and the event is delivered again.
type Handler func(ctx context.Context, tx pgx.Tx, e event.EventEnvelope) error

type kind struct {
	eventType string
	version   int
}

const (
	// retryReach is the wait before trying again to reach a Kafka that did not answer.
	retryReach = 5 * time.Second
	// reachTimeout bounds each step of an attempt to reach Kafka.
	reachTimeout = 3 * time.Second
)

// errAppliedMeanwhile rolls back a transaction whose event another delivery applied first.
var errAppliedMeanwhile = errors.New("the event was applied meanwhile")

// Router reads the topics of the service in its consumer group and has each event applied once.
type Router struct {
	brokers  []string
	group    string
	pool     *pgxpool.Pool
	logger   *slog.Logger
	handlers map[string]map[kind]Handler
	// reach returns nil once Kafka answers.
	reach func() error
}

// NewRouter returns a router of the consumer group that records the applied events in the database of pool.
func NewRouter(brokers []string, group string, pool *pgxpool.Pool, logger *slog.Logger) *Router {
	return &Router{brokers: brokers, group: group, pool: pool, logger: logger, handlers: map[string]map[kind]Handler{}, reach: func() error {
		config := sarama.NewConfig()
		// Short, so that a Kafka that accepts connections and never answers does not hold up the stop of the service.
		config.Net.DialTimeout, config.Net.ReadTimeout, config.Net.WriteTimeout = reachTimeout, reachTimeout, reachTimeout
		config.Metadata.Retry.Max = 0
		client, err := sarama.NewClient(brokers, config)
		if err != nil {
			return err
		}
		return client.Close()
	}}
}

// Handle has h apply the events of type eventType and version that arrive on topic; the router skips the other events. Call it before Run.
func (r *Router) Handle(topic, eventType string, version int, h Handler) {
	if r.handlers[topic] == nil {
		r.handlers[topic] = map[kind]Handler{}
	}
	r.handlers[topic][kind{eventType, version}] = h
}

// Run reads the topics until ctx is cancelled. The offset of an event is committed only after its transaction.
// While Kafka does not answer at start, Run waits for it; once reading, Watermill reconnects by itself.
func (r *Router) Run(ctx context.Context) error {
	if r.group == "" {
		return errors.New("a router needs a consumer group, or each replica would read every event")
	}
	for {
		if ctx.Err() != nil {
			return nil
		}
		err := r.reach()
		if err == nil {
			break
		}
		r.logger.WarnContext(ctx, "Kafka does not answer, the consumers wait for it", "err", err)
		select {
		case <-ctx.Done():
			return nil
		case <-time.After(retryReach):
		}
	}
	logger := watermill.NewSlogLogger(r.logger)
	config := kafka.DefaultSaramaSubscriberConfig()
	// A new consumer group starts from the oldest event, so a service also reads the events published before its first start.
	config.Consumer.Offsets.Initial = sarama.OffsetOldest
	subscriber, err := kafka.NewSubscriber(kafka.SubscriberConfig{
		Brokers:               r.brokers,
		ConsumerGroup:         r.group,
		OverwriteSaramaConfig: config,
		// A handler that fails, for instance while the database is down, is tried again once a second.
		NackResendSleep: time.Second,
	}, logger)
	if err != nil {
		return fmt.Errorf("create the Kafka subscriber: %w", err)
	}
	defer func() { _ = subscriber.Close() }()
	router, err := message.NewRouter(message.RouterConfig{}, logger)
	if err != nil {
		return fmt.Errorf("create the router of the consumers: %w", err)
	}
	for topic, handlers := range r.handlers {
		router.AddConsumerHandler(r.group+"-"+topic, topic, subscriber, r.apply(topic, handlers))
	}
	if err := router.Run(ctx); err != nil {
		return fmt.Errorf("run the router of the consumers: %w", err)
	}
	return nil
}

func (r *Router) apply(topic string, handlers map[kind]Handler) message.NoPublishHandlerFunc {
	return func(msg *message.Message) error {
		ctx := msg.Context()
		e, err := event.Decode(msg.Payload)
		if err != nil {
			// Delivered again, it would fail the same way and hold up every event after it in its partition.
			partition, _ := kafka.MessagePartitionFromCtx(ctx)
			offset, _ := kafka.MessagePartitionOffsetFromCtx(ctx)
			r.logger.ErrorContext(ctx, "skip a record that is not an event envelope", "topic", topic, "partition", partition, "offset", offset, "err", err)
			return nil
		}
		h, ok := handlers[kind{e.Type, e.Version}]
		if !ok {
			return nil
		}
		err = pgx.BeginFunc(ctx, r.pool, func(tx pgx.Tx) error {
			// Only read before the handler: a write would give the transaction its id before the handler locks its aggregate, and the outbox orders the events by that id.
			var applied bool
			if err := tx.QueryRow(ctx, "SELECT EXISTS (SELECT FROM applied_events WHERE event_id = $1)", e.EventId).Scan(&applied); err != nil {
				return fmt.Errorf("check whether event %s was applied: %w", e.EventId, err)
			}
			if applied {
				return nil
			}
			if err := h(ctx, tx, e); err != nil {
				return fmt.Errorf("apply event %s %s: %w", e.Type, e.EventId, err)
			}
			// A concurrent delivery of the same event waits here for the other transaction, and gives up if it committed.
			tag, err := tx.Exec(ctx, "INSERT INTO applied_events (event_id) VALUES ($1) ON CONFLICT DO NOTHING", e.EventId)
			if err != nil {
				return fmt.Errorf("record event %s as applied: %w", e.EventId, err)
			}
			if tag.RowsAffected() == 0 {
				return errAppliedMeanwhile
			}
			return nil
		})
		if errors.Is(err, errAppliedMeanwhile) {
			return nil
		}
		return err
	}
}
