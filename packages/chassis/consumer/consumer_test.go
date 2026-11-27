package consumer_test

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/ThreeDotsLabs/watermill"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Bending-Forks/gotion/packages/chassis/consumer"
	"github.com/Bending-Forks/gotion/packages/chassis/event"
	"github.com/Bending-Forks/gotion/packages/chassis/internal/chassistest"
)

// Integration tests against a real Kafka and PostgreSQL. The events are produced with no Watermill header, as Editing produces them, so the router can only recognise a repeated one by the identifier in its envelope.
// The handler of the tests stores each event it applies in the table applied, in the transaction the router gives it.

const appliedSchema = "CREATE TABLE applied (event_id text NOT NULL);"

type fixture struct {
	brokers []string
	topic   string
	pool    *pgxpool.Pool
}

func newFixture(t *testing.T) fixture {
	t.Helper()
	brokers := chassistest.Brokers(t)
	url := chassistest.Database(t, consumer.Schema+appliedSchema)
	pool, err := pgxpool.New(t.Context(), url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	return fixture{brokers, chassistest.Topic(t, brokers), pool}
}

func (f fixture) produce(t *testing.T, e event.EventEnvelope) {
	t.Helper()
	value, err := json.Marshal(e)
	if err != nil {
		t.Fatal(err)
	}
	chassistest.Produce(t, f.brokers, f.topic, e.AggregateId, value)
}

// run starts a router of group with handler on the events SomethingHappened v1 of the topic, and stops it at the end of the test.
func (f fixture) run(t *testing.T, group string, handler consumer.Handler) (stop func()) {
	t.Helper()
	router := consumer.NewRouter(f.brokers, group, f.pool, slog.New(slog.DiscardHandler))
	router.Handle(f.topic, "SomethingHappened", 1, handler)
	ctx, cancel := context.WithCancel(t.Context())
	done := make(chan error, 1)
	go func() { done <- router.Run(ctx) }()
	stopped := false
	stop = func() {
		if stopped {
			return
		}
		stopped = true
		cancel()
		if err := <-done; err != nil {
			t.Errorf("Run: %v", err)
		}
	}
	t.Cleanup(stop)
	return stop
}

func (f fixture) applied(t *testing.T, id string) int {
	t.Helper()
	var n int
	if err := f.pool.QueryRow(t.Context(), "SELECT count(*) FROM applied WHERE event_id = $1", id).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func record(ctx context.Context, tx pgx.Tx, e event.EventEnvelope) error {
	_, err := tx.Exec(ctx, "INSERT INTO applied (event_id) VALUES ($1)", e.EventId)
	return err
}

func something(aggregate string) event.EventEnvelope {
	return event.EventEnvelope{
		EventId:     watermill.NewUUID(),
		Type:        "SomethingHappened",
		Version:     1,
		AggregateId: aggregate,
		OccurredAt:  time.Now().UTC(),
		Data:        event.EventEnvelopeData{},
	}
}

func TestRouterAppliesAnEventDeliveredTwiceOnce(t *testing.T) {
	f := newFixture(t)
	aggregate := watermill.NewUUID()
	repeated, last := something(aggregate), something(aggregate)
	f.produce(t, repeated)
	f.produce(t, repeated)
	f.produce(t, last)

	f.run(t, "test", record)

	// The events of one aggregate share a partition and are read in order, so once the last one is applied the repeated one has been read twice.
	chassistest.Eventually(t, 30*time.Second, "the last event is applied", func() bool { return f.applied(t, last.EventId) == 1 })
	if n := f.applied(t, repeated.EventId); n != 1 {
		t.Fatalf("the repeated event was applied %d times, want 1", n)
	}
}

// A consumer that restarts after the transaction of an event and before committing its offset reads the event again.
// The test forgets the offsets of the group, as if the commit had never happened, and restarts the same group.
func TestRouterSkipsAnEventAppliedBeforeARestart(t *testing.T) {
	f := newFixture(t)
	aggregate := watermill.NewUUID()
	first := something(aggregate)
	f.produce(t, first)
	stop := f.run(t, "test", record)
	chassistest.Eventually(t, 30*time.Second, "the event is applied", func() bool { return f.applied(t, first.EventId) == 1 })
	stop()
	chassistest.ForgetOffsets(t, f.brokers, "test", f.topic)

	next := something(aggregate)
	f.produce(t, next)
	f.run(t, "test", record)

	chassistest.Eventually(t, 30*time.Second, "the next event is applied", func() bool { return f.applied(t, next.EventId) == 1 })
	if n := f.applied(t, first.EventId); n != 1 {
		t.Fatalf("the event read again after the restart was applied %d times, want 1", n)
	}
}

// While the transaction of an event is open, the group commits no offset for it, so a crash at that moment delivers the event again.
func TestRouterCommitsTheOffsetOnlyAfterTheTransaction(t *testing.T) {
	f := newFixture(t)
	e := something(watermill.NewUUID())
	f.produce(t, e)
	inside, released := make(chan struct{}), make(chan struct{})
	var once sync.Once
	release := func() { once.Do(func() { close(released) }) }
	f.run(t, "test", func(ctx context.Context, tx pgx.Tx, e event.EventEnvelope) error {
		close(inside)
		<-released
		return record(ctx, tx, e)
	})
	// Runs before the router stops, so a failing test does not leave the handler waiting.
	t.Cleanup(release)
	select {
	case <-inside:
	case <-time.After(30 * time.Second):
		t.Fatal("the handler was not called")
	}
	// Sarama commits the marked offsets every second: two seconds give it the chance to commit too early.
	time.Sleep(2 * time.Second)
	if offset := chassistest.Committed(t, f.brokers, "test", f.topic); offset != -1 {
		t.Fatalf("the group committed offset %d while the transaction of the event was open", offset)
	}
	release()

	chassistest.Eventually(t, 30*time.Second, "the offset is committed after the transaction", func() bool { return chassistest.Committed(t, f.brokers, "test", f.topic) == 1 })
	if n := f.applied(t, e.EventId); n != 1 {
		t.Fatalf("the event was applied %d times, want 1", n)
	}
}

// The handler takes the lock of its aggregate before any write, and the outbox orders the events by the transaction that wrote them: the router must not write before the handler, or a transaction id taken early could put the events of the handler before those of a command that changed the aggregate first.
func TestRouterLetsTheHandlerWriteFirst(t *testing.T) {
	f := newFixture(t)
	e := something(watermill.NewUUID())
	f.produce(t, e)
	var first atomic.Bool
	f.run(t, "test", func(ctx context.Context, tx pgx.Tx, e event.EventEnvelope) error {
		var noWrite bool
		if err := tx.QueryRow(ctx, "SELECT pg_current_xact_id_if_assigned() IS NULL").Scan(&noWrite); err != nil {
			return err
		}
		first.Store(noWrite)
		return record(ctx, tx, e)
	})

	chassistest.Eventually(t, 30*time.Second, "the event is applied", func() bool { return f.applied(t, e.EventId) == 1 })
	if !first.Load() {
		t.Fatal("the transaction had written before the handler")
	}
}

// Two deliveries of one event can run at the same time, for instance on two replicas during a rebalance: both handlers run, and only one of their transactions commits.
func TestRouterAppliesOnceAnEventHandledTwiceAtTheSameTime(t *testing.T) {
	f := newFixture(t)
	e := something(watermill.NewUUID())
	f.produce(t, e)
	var calls atomic.Int32
	both := make(chan struct{})
	handler := func(ctx context.Context, tx pgx.Tx, e event.EventEnvelope) error {
		if err := record(ctx, tx, e); err != nil {
			return err
		}
		if calls.Add(1) == 2 {
			close(both)
		}
		select {
		case <-both:
		case <-time.After(10 * time.Second):
		}
		return nil
	}
	// Two groups read the same event, as two replicas would after a rebalance.
	f.run(t, "first", handler)
	f.run(t, "second", handler)

	chassistest.Eventually(t, 30*time.Second, "both handlers run", func() bool { return calls.Load() == 2 })
	// Both groups commit their offset only after their transaction has ended, committed or rolled back.
	chassistest.Eventually(t, 30*time.Second, "both groups are done with the event", func() bool {
		return chassistest.Committed(t, f.brokers, "first", f.topic) == 1 && chassistest.Committed(t, f.brokers, "second", f.topic) == 1
	})
	var markers int
	if err := f.pool.QueryRow(t.Context(), "SELECT count(*) FROM applied_events WHERE event_id = $1", e.EventId).Scan(&markers); err != nil {
		t.Fatal(err)
	}
	if n := f.applied(t, e.EventId); n != 1 || markers != 1 {
		t.Fatalf("the event was applied %d times and recorded %d times, want 1 and 1", n, markers)
	}
}

// The identifier of an event is recorded in the transaction of its change, so a handler that fails leaves the event to be applied again.
func TestRouterAppliesAgainAnEventWhoseHandlerFailed(t *testing.T) {
	f := newFixture(t)
	e := something(watermill.NewUUID())
	f.produce(t, e)
	var calls atomic.Int32
	f.run(t, "test", func(ctx context.Context, tx pgx.Tx, e event.EventEnvelope) error {
		if err := record(ctx, tx, e); err != nil {
			return err
		}
		if calls.Add(1) == 1 {
			return errors.New("the first attempt fails after its change")
		}
		return nil
	})

	chassistest.Eventually(t, 30*time.Second, "the event is applied", func() bool { return calls.Load() >= 2 && f.applied(t, e.EventId) == 1 })
	if n := f.applied(t, e.EventId); n != 1 {
		t.Fatalf("the event was applied %d times, want 1", n)
	}
}

// An event of another type or version, a record that is not an envelope and an envelope without an identifier do not stop the events after them.
func TestRouterSkipsTheEventsItDoesNotHandle(t *testing.T) {
	f := newFixture(t)
	aggregate := watermill.NewUUID()
	otherType, otherVersion, last := something(aggregate), something(aggregate), something(aggregate)
	otherType.Type = "SomethingElseHappened"
	otherVersion.Version = 2
	chassistest.Produce(t, f.brokers, f.topic, aggregate, []byte(`{"not": "an envelope"}`))
	noID := something(aggregate)
	noID.EventId = ""
	f.produce(t, noID)
	f.produce(t, otherType)
	f.produce(t, otherVersion)
	f.produce(t, last)

	f.run(t, "test", record)

	chassistest.Eventually(t, 30*time.Second, "the last event is applied", func() bool { return f.applied(t, last.EventId) == 1 })
	for _, skipped := range []event.EventEnvelope{otherType, otherVersion, noID} {
		if n := f.applied(t, skipped.EventId); n != 0 {
			t.Errorf("event %s %d was applied %d times, want 0", skipped.Type, skipped.Version, n)
		}
	}
}

// A router stopped while it starts, as a service is when it shuts down at once, returns no error.
func TestRunStoppedAtOnceReturnsNoError(t *testing.T) {
	f := newFixture(t)
	router := consumer.NewRouter(f.brokers, "test", f.pool, slog.New(slog.DiscardHandler))
	router.Handle(f.topic, "SomethingHappened", 1, record)
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	if err := router.Run(ctx); err != nil {
		t.Fatalf("Run stopped at once: %v", err)
	}
}

func TestRunRefusesAnEmptyConsumerGroup(t *testing.T) {
	router := consumer.NewRouter([]string{"localhost:9092"}, "", nil, slog.New(slog.DiscardHandler))
	if err := router.Run(t.Context()); err == nil {
		t.Fatal("Run started without a consumer group, so its replicas would each read every event")
	}
}
