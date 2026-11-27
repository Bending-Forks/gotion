package outbox

import (
	"context"
	"errors"
	"log/slog"
	"slices"
	"sync/atomic"
	"testing"
	"time"

	"github.com/ThreeDotsLabs/watermill"
	"github.com/ThreeDotsLabs/watermill/message"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"

	"github.com/Bending-Forks/gotion/packages/chassis/consumer"
	"github.com/Bending-Forks/gotion/packages/chassis/event"
	"github.com/Bending-Forks/gotion/packages/chassis/internal/chassistest"
)

// The faults of the outbox, against a real PostgreSQL and Kafka. Kafka is shared with the other tests and with development, so a Kafka that is down is one the Forwarder cannot reach: it connects to an address where no broker listens.

// unreachable is a Kafka address where nothing listens.
var unreachable = []string{"127.0.0.1:1"}

// publisherFunc is a Kafka publisher that a test can make fail in the middle of a publication.
type publisherFunc func(topic string, messages ...*message.Message) error

func (p publisherFunc) Publish(topic string, messages ...*message.Message) error {
	return p(topic, messages...)
}

func (p publisherFunc) Close() error { return nil }

func TestPendingEventArrivesWhenKafkaComesBackAfterTheServiceRestarted(t *testing.T) {
	f := newFixture(t)
	var up atomic.Bool
	var failed atomic.Int32
	connect := func() (message.Publisher, error) {
		if up.Load() {
			return event.NewPublisher(f.brokers, slog.New(slog.DiscardHandler))
		}
		publisher, err := event.NewPublisher(unreachable, slog.New(slog.DiscardHandler))
		if err != nil {
			failed.Add(1)
		}
		return publisher, err
	}
	_, stop := f.run(t, connect)
	chassistest.Eventually(t, time.Minute, "the Forwarder fails to reach Kafka", func() bool { return failed.Load() >= 1 })
	e := something(watermill.NewUUID())
	if err := f.command(t.Context(), e.AggregateId, false, e); err != nil {
		t.Fatalf("a command failed while Kafka was down: %v", err)
	}
	stop()

	// The service starts again while Kafka is still down, and fails to reach it in turn: the event waits in the outbox.
	before := failed.Load()
	fwd, _ := f.run(t, connect)
	chassistest.Eventually(t, time.Minute, "the restarted Forwarder fails to reach Kafka", func() bool { return failed.Load() > before })
	if err := fwd.measure(t.Context()); err != nil {
		t.Fatal(err)
	}
	if n := testutil.ToFloat64(fwd.pending); n != 1 {
		t.Fatalf("pending events = %v while Kafka is down, want 1", n)
	}
	up.Store(true)

	f.read(t, e)
}

func TestDuplicateAfterAnAckNotYetMarkedChangesNothingInTheConsumer(t *testing.T) {
	f := newFixture(t)
	aggregate := watermill.NewUUID()
	e := something(aggregate)
	if err := f.command(t.Context(), aggregate, false, e); err != nil {
		t.Fatal(err)
	}
	kafka, err := event.NewPublisher(f.brokers, slog.New(slog.DiscardHandler))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = kafka.Close() })

	// The publisher stops once Kafka has acknowledged the event, before the Forwarder marks its row as sent.
	ctx, crash := context.WithTimeout(t.Context(), time.Minute)
	defer crash()
	var crashed atomic.Bool
	crashing, err := newForwarder(f.pool, func() (message.Publisher, error) {
		return publisherFunc(func(topic string, messages ...*message.Message) error {
			if crashed.Load() {
				return errors.New("stopped")
			}
			if err := kafka.Publish(topic, messages...); err != nil {
				return err
			}
			crashed.Store(true)
			crash()
			return errors.New("stopped after the acknowledgement")
		}), nil
	}, slog.New(slog.DiscardHandler), prometheus.NewRegistry())
	if err != nil {
		t.Fatal(err)
	}
	if err := crashing.Run(ctx); err != nil {
		t.Fatal(err)
	}
	if !crashed.Load() {
		t.Fatal("the publisher did not stop after the acknowledgement")
	}
	if err := crashing.measure(t.Context()); err != nil {
		t.Fatal(err)
	}
	if n := testutil.ToFloat64(crashing.pending); n != 1 {
		t.Fatalf("pending events = %v after the stop, want the event sent but not marked", n)
	}

	// After the restart the event is published again, then one more event of the aggregate.
	f.run(t, f.kafka(t))
	last := something(aggregate)
	if err := f.command(t.Context(), aggregate, false, last); err != nil {
		t.Fatal(err)
	}
	// The partition of the aggregate holds the event twice, with the same identifier, then the last one.
	var ids []string
	for _, r := range f.read(t, e, last) {
		ids = append(ids, r.EventId)
	}
	if want := []string{e.EventId, e.EventId, last.EventId}; !slices.Equal(ids, want) {
		t.Fatalf("the topic holds the events %v, want %v", ids, want)
	}

	applied, total := consume(t, f, func(ctx context.Context, tx pgx.Tx, e event.EventEnvelope) error {
		_, err := tx.Exec(ctx, "INSERT INTO applied (event_id) VALUES ($1)", e.EventId)
		return err
	})
	// The events of the aggregate are read in order, so once the last one is applied both copies have been read.
	chassistest.Eventually(t, 30*time.Second, "the last event is applied", func() bool { return applied(last.EventId) == 1 })
	if n, all := applied(e.EventId), total(); n != 1 || all != 2 {
		t.Fatalf("the event published twice was applied %d times, and %d changes were applied in all; want 1 and 2", n, all)
	}
}

func TestEventsOfAnAggregateKeepTheOrderOfTheirTransactionsWithCompetingPublishers(t *testing.T) {
	f := newFixture(t)
	_, stopFirst := f.run(t, f.kafka(t))
	_, stopSecond := f.run(t, f.kafka(t))
	aggregates := []string{watermill.NewUUID(), watermill.NewUUID()}
	const writers, commandsEach = 8, 10

	// Each command locks its aggregate first, then raises an event that carries the new version.
	errs := make(chan error, writers)
	for w := range writers {
		aggregate := aggregates[w%len(aggregates)]
		go func() {
			for range commandsEach {
				if err := f.versioned(t.Context(), aggregate); err != nil {
					errs <- err
					return
				}
			}
			errs <- nil
		}()
	}
	// Every writer ends before the test can fail, since they use the fixture.
	var failed error
	for range writers {
		if err := <-errs; err != nil && failed == nil {
			failed = err
		}
	}
	if failed != nil {
		t.Fatal(failed)
	}

	total := writers * commandsEach
	var got []received
	chassistest.Read(t, f.brokers, f.topic, 60*time.Second, func(records []chassistest.Record) bool {
		got = decode(t, records)
		return len(unique(got)) == total
	})
	// The replicas share one lock, so with no failure each event is sent once.
	stopFirst()
	stopSecond()
	if n := chassistest.Count(t, f.brokers, f.topic); n != int64(total) {
		t.Fatalf("the topic has %d records for %d events: both replicas sent some of them", n, total)
	}
	versions := map[string][]float64{}
	for _, r := range unique(got) {
		v, ok := r.Data["version"].(float64)
		if !ok {
			t.Fatalf("event %s has no version: %v", r.EventId, r.Data)
		}
		versions[r.AggregateId] = append(versions[r.AggregateId], v)
	}
	for aggregate, vs := range versions {
		for i, v := range vs {
			if v != float64(i+1) {
				t.Fatalf("aggregate %s: versions arrived in the order %v, want 1 to %d", aggregate, vs, len(vs))
			}
		}
	}
}

func TestAnotherReplicaTakesOverWhenTheActivePublisherStops(t *testing.T) {
	f := newFixture(t)
	e := something(watermill.NewUUID())
	if err := f.command(t.Context(), e.AggregateId, false, e); err != nil {
		t.Fatal(err)
	}

	// The active replica hangs while it publishes, holding the lock, until it is stopped.
	publishing := make(chan struct{}, 1)
	_, stop := f.run(t, func() (message.Publisher, error) {
		return publisherFunc(func(_ string, messages ...*message.Message) error {
			select {
			case publishing <- struct{}{}:
			default:
			}
			<-messages[0].Context().Done()
			return messages[0].Context().Err()
		}), nil
	})
	select {
	case <-publishing:
	case <-time.After(30 * time.Second):
		t.Fatal("the first replica did not start publishing")
	}
	f.run(t, f.kafka(t))
	chassistest.Eventually(t, 30*time.Second, "the second replica waits for the lock of the first one", func() bool {
		var waiting bool
		err := f.pool.QueryRow(t.Context(), `SELECT EXISTS (SELECT FROM pg_stat_activity
			WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%FOR UPDATE%')`).Scan(&waiting)
		if err != nil {
			t.Fatal(err)
		}
		return waiting
	})
	if n := chassistest.Count(t, f.brokers, f.topic); n != 0 {
		t.Fatalf("the second replica published %d events while the first one held the lock", n)
	}

	stop()

	f.read(t, e)
}

// versioned bumps the version of the aggregate and raises an event with the new version, in one transaction.
func (f fixture) versioned(ctx context.Context, aggregate string) error {
	return pgx.BeginFunc(ctx, f.pool, func(tx pgx.Tx) error {
		var version int
		err := tx.QueryRow(ctx, "INSERT INTO aggregates (id, version) VALUES ($1, 1) ON CONFLICT (id) DO UPDATE SET version = aggregates.version + 1 RETURNING version", aggregate).Scan(&version)
		if err != nil {
			return err
		}
		e := something(aggregate)
		e.Data = event.EventEnvelopeData{"version": version}
		return Publish(ctx, tx, f.topic, e)
	})
}

// consume runs a consumer of the topic on a database of its own, whose handler records the events it applies, and returns how many times an event was applied and how many changes were applied in all.
func consume(t *testing.T, f fixture, handler consumer.Handler) (applied func(eventID string) int, total func() int) {
	t.Helper()
	pool, err := pgxpool.New(t.Context(), chassistest.Database(t, consumer.Schema+"CREATE TABLE applied (event_id text NOT NULL);"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	router := consumer.NewRouter(f.brokers, "test", pool, slog.New(slog.DiscardHandler))
	router.Handle(f.topic, "SomethingHappened", 1, handler)
	ctx, cancel := context.WithCancel(t.Context())
	done := make(chan error, 1)
	go func() { done <- router.Run(ctx) }()
	t.Cleanup(func() {
		cancel()
		if err := <-done; err != nil {
			t.Errorf("Run: %v", err)
		}
	})
	count := func(where string, args ...any) int {
		var n int
		if err := pool.QueryRow(t.Context(), "SELECT count(*) FROM applied "+where, args...).Scan(&n); err != nil {
			t.Fatal(err)
		}
		return n
	}
	return func(eventID string) int { return count("WHERE event_id = $1", eventID) }, func() int { return count("") }
}
