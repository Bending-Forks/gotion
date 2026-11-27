package event

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"regexp"

	"github.com/IBM/sarama"
	"github.com/ThreeDotsLabs/watermill"
	"github.com/ThreeDotsLabs/watermill-kafka/v3/pkg/kafka"
	"github.com/ThreeDotsLabs/watermill/message"
)

// maxEventBytes keeps an event well under the 1 MB that Kafka accepts by default for a record, key and headers included.
const maxEventBytes = 512 << 10

var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// Decode reads an envelope and checks it against api/envelope.schema.json, including what the generated type does not check: the UUID format of the identifiers, and a body and a time that are not null.
func Decode(payload []byte) (EventEnvelope, error) {
	var e EventEnvelope
	if err := json.Unmarshal(payload, &e); err != nil {
		return EventEnvelope{}, fmt.Errorf("read the envelope: %w", err)
	}
	if !uuidPattern.MatchString(e.EventId) || !uuidPattern.MatchString(e.AggregateId) {
		return EventEnvelope{}, fmt.Errorf("event %q of aggregate %q: the identifiers must be UUIDs", e.EventId, e.AggregateId)
	}
	if e.Data == nil || e.OccurredAt.IsZero() {
		return EventEnvelope{}, fmt.Errorf("event %s has no body or no time", e.EventId)
	}
	return e, nil
}

// NewMessage turns an envelope into the Watermill message that carries it, with the identifier of the event as its UUID.
// It refuses an envelope that Decode or Kafka would refuse: in the outbox it would hold up every event after it.
func NewMessage(ctx context.Context, e EventEnvelope) (*message.Message, error) {
	payload, err := json.Marshal(e)
	if err != nil {
		return nil, fmt.Errorf("encode event %s: %w", e.EventId, err)
	}
	if _, err := Decode(payload); err != nil {
		return nil, err
	}
	if len(payload) > maxEventBytes {
		return nil, fmt.Errorf("event %s has %d bytes, more than the %d an event may have", e.EventId, len(payload), maxEventBytes)
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
	if len(msg.Payload) > maxEventBytes {
		return "", fmt.Errorf("message %s has %d bytes, more than the %d an event may have", msg.UUID, len(msg.Payload), maxEventBytes)
	}
	e, err := Decode(msg.Payload)
	if err != nil {
		return "", fmt.Errorf("message %s: %w", msg.UUID, err)
	}
	return e.AggregateId, nil
}
