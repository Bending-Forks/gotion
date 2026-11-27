package event_test

import (
	"strings"
	"testing"

	"github.com/ThreeDotsLabs/watermill"

	"github.com/Bending-Forks/gotion/packages/chassis/event"
)

// An envelope the schema refuses could never be published, so it is refused before it reaches the outbox.
func TestNewMessageRefusesAnEnvelopeTheSchemaRefuses(t *testing.T) {
	for _, tt := range []struct {
		name   string
		change func(*event.EventEnvelope)
	}{
		{"version below 1", func(e *event.EventEnvelope) { e.Version = 0 }},
		{"type not in PascalCase", func(e *event.EventEnvelope) { e.Type = "something_happened" }},
		{"empty event identifier", func(e *event.EventEnvelope) { e.EventId = "" }},
		{"aggregate that is not a UUID", func(e *event.EventEnvelope) { e.AggregateId = "workspace-1" }},
		{"body too large for Kafka", func(e *event.EventEnvelope) { e.Data["text"] = strings.Repeat("x", 1<<20) }},
	} {
		t.Run(tt.name, func(t *testing.T) {
			e := envelope(watermill.NewUUID(), 0)
			tt.change(&e)
			if _, err := event.NewMessage(t.Context(), e); err == nil {
				t.Fatal("NewMessage accepted an envelope the schema refuses")
			}
		})
	}
}

// The other end of Kafka reads an envelope with the same checks: null or malformed identifiers are refused.
func TestDecodeRefusesAnEnvelopeWithMalformedIdentifiers(t *testing.T) {
	valid := `"type":"SomethingHappened","version":1,"occurredAt":"2026-11-27T10:00:00Z","data":{}`
	for _, tt := range []struct{ name, payload string }{
		{"null event identifier", `{"eventId":null,"aggregateId":"8f14e45f-ceea-467a-9575-1b4f0c3a2d11",` + valid + `}`},
		{"empty aggregate", `{"eventId":"0b9a6c1e-6f0d-4c7a-9a43-2f1d5e8b7c10","aggregateId":"",` + valid + `}`},
		{"not JSON", `not an envelope`},
	} {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := event.Decode([]byte(tt.payload)); err == nil {
				t.Fatal("Decode accepted a malformed envelope")
			}
		})
	}
	e, err := event.Decode([]byte(`{"eventId":"0b9a6c1e-6f0d-4c7a-9a43-2f1d5e8b7c10","aggregateId":"8f14e45f-ceea-467a-9575-1b4f0c3a2d11",` + valid + `}`))
	if err != nil || e.Type != "SomethingHappened" {
		t.Fatalf("Decode of a valid envelope = %+v, %v", e, err)
	}
}
