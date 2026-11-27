package event_test

import (
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
