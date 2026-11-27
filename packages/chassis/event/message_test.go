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
		{"no body", func(e *event.EventEnvelope) { e.Data = nil }},
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
		{"null body", `{"eventId":"0b9a6c1e-6f0d-4c7a-9a43-2f1d5e8b7c10","aggregateId":"8f14e45f-ceea-467a-9575-1b4f0c3a2d11","type":"SomethingHappened","version":1,"occurredAt":"2026-11-27T10:00:00Z","data":null}`},
		{"null time", `{"eventId":"0b9a6c1e-6f0d-4c7a-9a43-2f1d5e8b7c10","aggregateId":"8f14e45f-ceea-467a-9575-1b4f0c3a2d11","type":"SomethingHappened","version":1,"occurredAt":null,"data":{}}`},
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

// encoding/json matches a field whatever its case, so another field such as AggregateId must not stand in for aggregateId; and one UUID in two cases is one identity.
func TestDecodeReadsTheIdentitiesByTheirExactNamesInLowerCase(t *testing.T) {
	e, err := event.Decode([]byte(`{"eventId":"0B9A6C1E-6F0D-4C7A-9A43-2F1D5E8B7C10","aggregateId":"8F14E45F-CEEA-467A-9575-1B4F0C3A2D11",` +
		`"AggregateId":"c4ca4238-a0b9-4382-8dcc-509a6f75849b","EventId":"c4ca4238-a0b9-4382-8dcc-509a6f75849b",` +
		`"type":"SomethingHappened","version":1,"occurredAt":"2026-11-27T10:00:00Z","data":{}}`))
	if err != nil {
		t.Fatal(err)
	}
	if e.EventId != "0b9a6c1e-6f0d-4c7a-9a43-2f1d5e8b7c10" || e.AggregateId != "8f14e45f-ceea-467a-9575-1b4f0c3a2d11" {
		t.Fatalf("Decode read event %s of aggregate %s", e.EventId, e.AggregateId)
	}
}
