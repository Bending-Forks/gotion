package event_test

import (
	"encoding/json"
	"log/slog"
	"testing"
	"time"

	"github.com/ThreeDotsLabs/watermill"

	"github.com/Bending-Forks/gotion/packages/chassis/event"
	"github.com/Bending-Forks/gotion/packages/chassis/internal/chassistest"
)

// Integration test against a real Kafka: the events of two aggregates go to a topic of the test, and each arrives keyed by its aggregate, so the events of one aggregate share a partition.
func TestPublisherKeysEachEventByItsAggregate(t *testing.T) {
	brokers := chassistest.Brokers(t)
	topic := chassistest.Topic(t, brokers)
	publisher, err := event.NewPublisher(brokers, slog.New(slog.DiscardHandler))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = publisher.Close() })

	aggregates := []string{watermill.NewUUID(), watermill.NewUUID()}
	const perAggregate = 5
	for i := range perAggregate {
		for _, aggregate := range aggregates {
			msg, err := event.NewMessage(t.Context(), envelope(aggregate, i))
			if err != nil {
				t.Fatal(err)
			}
			if err := publisher.Publish(topic, msg); err != nil {
				t.Fatal(err)
			}
		}
	}

	records := chassistest.Read(t, brokers, topic, 30*time.Second, func(r []chassistest.Record) bool { return len(r) == perAggregate*len(aggregates) })
	partition := map[string]int32{}
	for _, r := range records {
		var e event.EventEnvelope
		if err := json.Unmarshal(r.Value, &e); err != nil {
			t.Fatal(err)
		}
		if r.Key != e.AggregateId {
			t.Errorf("event %s has key %q, want its aggregate %q", e.EventId, r.Key, e.AggregateId)
		}
		if p, seen := partition[e.AggregateId]; seen && p != r.Partition {
			t.Errorf("aggregate %s has events in partitions %d and %d", e.AggregateId, p, r.Partition)
		}
		partition[e.AggregateId] = r.Partition
	}
}

// A message that is not an envelope is refused before it reaches Kafka, since it has no aggregate to key it by.
func TestPublisherRefusesAMessageThatIsNotAnEnvelope(t *testing.T) {
	brokers := chassistest.Brokers(t)
	topic := chassistest.Topic(t, brokers)
	publisher, err := event.NewPublisher(brokers, slog.New(slog.DiscardHandler))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = publisher.Close() })

	msg, err := event.NewMessage(t.Context(), envelope(watermill.NewUUID(), 0))
	if err != nil {
		t.Fatal(err)
	}
	msg.Payload = []byte(`{"type":"WorkspaceCreated"}`)
	if err := publisher.Publish(topic, msg); err == nil {
		t.Fatal("Publish accepted a message without an aggregate")
	}
}

func envelope(aggregate string, i int) event.EventEnvelope {
	return event.EventEnvelope{
		EventId:     watermill.NewUUID(),
		Type:        "SomethingHappened",
		Version:     1,
		AggregateId: aggregate,
		OccurredAt:  time.Now().UTC(),
		Data:        event.EventEnvelopeData{"aggregateId": aggregate, "sequence": i},
	}
}
