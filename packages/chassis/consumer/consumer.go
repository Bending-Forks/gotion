package consumer

import (
	"context"
	"encoding/json"
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

// Router reads the topics of the service in its consumer group and has each event applied once.
type Router struct {
	brokers  []string
	group    string
	pool     *pgxpool.Pool
	logger   *slog.Logger
	handlers map[string]map[kind]Handler
}

// NewRouter returns a router of the consumer group that records the applied events in the database of pool.
func NewRouter(brokers []string, group string, pool *pgxpool.Pool, logger *slog.Logger) *Router {
	return &Router{brokers: brokers, group: group, pool: pool, logger: logger, handlers: map[string]map[kind]Handler{}}
}

// Handle has h apply the events of type eventType and version that arrive on topic; the router skips the other events. Call it before Run.
func (r *Router) Handle(topic, eventType string, version int, h Handler) {
	if r.handlers[topic] == nil {
		r.handlers[topic] = map[kind]Handler{}
	}
	r.handlers[topic][kind{eventType, version}] = h
}

// Run reads the topics until ctx is cancelled. The offset of an event is committed only after its transaction.
func (r *Router) Run(ctx context.Context) error {
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
		var e event.EventEnvelope
		if err := json.Unmarshal(msg.Payload, &e); err != nil {
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
		return pgx.BeginFunc(ctx, r.pool, func(tx pgx.Tx) error {
			tag, err := tx.Exec(ctx, "INSERT INTO applied_events (event_id) VALUES ($1) ON CONFLICT DO NOTHING", e.EventId)
			if err != nil {
				return fmt.Errorf("record event %s as applied: %w", e.EventId, err)
			}
			if tag.RowsAffected() == 0 {
				return nil
			}
			if err := h(ctx, tx, e); err != nil {
				return fmt.Errorf("apply event %s %s: %w", e.Type, e.EventId, err)
			}
			return nil
		})
	}
}
