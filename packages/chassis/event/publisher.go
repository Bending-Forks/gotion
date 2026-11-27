package event

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/IBM/sarama"
	"github.com/ThreeDotsLabs/watermill"
	"github.com/ThreeDotsLabs/watermill-kafka/v3/pkg/kafka"
	"github.com/ThreeDotsLabs/watermill/message"
)

// NewMessage turns an envelope into the Watermill message that carries it, with the identifier of the event as its UUID.
// It refuses an envelope the schema refuses, which the publisher could never send: in the outbox it would hold up every event after it.
func NewMessage(ctx context.Context, e EventEnvelope) (*message.Message, error) {
	payload, err := json.Marshal(e)
	if err != nil {
		return nil, fmt.Errorf("encode event %s: %w", e.EventId, err)
	}
	// The generated UnmarshalJSON is where the schema is checked.
	if err := json.Unmarshal(payload, &EventEnvelope{}); err != nil {
		return nil, fmt.Errorf("check event %s against the envelope schema: %w", e.EventId, err)
	}
	msg := message.NewMessage(e.EventId, payload)
	msg.SetContext(ctx)
	return msg, nil
}

// NewPublisher connects to Kafka a publisher that sends each message, an envelope, keyed by the identity of its aggregate.
// It is synchronous: Publish returns once every in-sync replica has acknowledged the message.
func NewPublisher(brokers []string, logger *slog.Logger) (*kafka.Publisher, error) {
	config := kafka.DefaultSaramaSyncPublisherConfig()
	config.Producer.RequiredAcks = sarama.WaitForAll
	publisher, err := kafka.NewPublisher(kafka.PublisherConfig{
		Brokers:               brokers,
		Marshaler:             kafka.NewWithPartitioningMarshaler(aggregateKey),
		OverwriteSaramaConfig: config,
	}, watermill.NewSlogLogger(logger))
	if err != nil {
		return nil, fmt.Errorf("connect the Kafka publisher: %w", err)
	}
	return publisher, nil
}

func aggregateKey(_ string, msg *message.Message) (string, error) {
	var e EventEnvelope
	if err := json.Unmarshal(msg.Payload, &e); err != nil {
		return "", fmt.Errorf("read the envelope of message %s: %w", msg.UUID, err)
	}
	return e.AggregateId, nil
}
