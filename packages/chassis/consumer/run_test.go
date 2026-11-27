package consumer

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"sync/atomic"
	"testing"
	"time"

	"github.com/ThreeDotsLabs/watermill"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Bending-Forks/gotion/packages/chassis/event"
	"github.com/Bending-Forks/gotion/packages/chassis/internal/chassistest"
)

// A consumer that starts while Kafka does not answer waits for it, then reads its events: Kafka stays up for the other tests, so the router sees it as down until the test says otherwise.
func TestRunWaitsForKafkaThenReadsTheEvents(t *testing.T) {
	brokers := chassistest.Brokers(t)
	pool, err := pgxpool.New(t.Context(), chassistest.Database(t, Schema+"CREATE TABLE applied (event_id text NOT NULL);"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	topic := chassistest.Topic(t, brokers)

	router := NewRouter(brokers, "test", pool, slog.New(slog.DiscardHandler))
	var up atomic.Bool
	var attempts atomic.Int32
	reach := router.reach
	router.reach = func() error {
		attempts.Add(1)
		if !up.Load() {
			return errors.New("Kafka does not answer")
		}
		return reach()
	}
	router.Handle(topic, "SomethingHappened", 1, func(ctx context.Context, tx pgx.Tx, e event.EventEnvelope) error {
		_, err := tx.Exec(ctx, "INSERT INTO applied (event_id) VALUES ($1)", e.EventId)
		return err
	})
	ctx, cancel := context.WithCancel(t.Context())
	done := make(chan error, 1)
	go func() { done <- router.Run(ctx) }()
	t.Cleanup(func() {
		cancel()
		if err := <-done; err != nil {
			t.Errorf("Run: %v", err)
		}
	})

	chassistest.Eventually(t, 30*time.Second, "the router tries to reach Kafka twice", func() bool { return attempts.Load() >= 2 })
	select {
	case err := <-done:
		t.Fatalf("Run returned while Kafka was down: %v", err)
	default:
	}
	e := event.EventEnvelope{EventId: watermill.NewUUID(), Type: "SomethingHappened", Version: 1, AggregateId: watermill.NewUUID(), OccurredAt: time.Now().UTC(), Data: event.EventEnvelopeData{}}
	value, err := json.Marshal(e)
	if err != nil {
		t.Fatal(err)
	}
	chassistest.Produce(t, brokers, topic, e.AggregateId, value)
	up.Store(true)

	chassistest.Eventually(t, 60*time.Second, "the event is applied once Kafka answers", func() bool {
		var n int
		if err := pool.QueryRow(t.Context(), "SELECT count(*) FROM applied WHERE event_id = $1", e.EventId).Scan(&n); err != nil {
			t.Fatal(err)
		}
		return n == 1
	})
}
