package outbox

import (
	"context"
	"encoding/json"
	"log/slog"
	"slices"
	"testing"
	"time"

	"github.com/ThreeDotsLabs/watermill"
	"github.com/ThreeDotsLabs/watermill-sql/v4/pkg/sql"
	"github.com/ThreeDotsLabs/watermill/message"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"

	"github.com/Bending-Forks/gotion/packages/chassis/event"
	"github.com/Bending-Forks/gotion/packages/chassis/internal/chassistest"
)

// Integration tests against a real PostgreSQL and Kafka. The command of the tests changes a row of the table aggregates and publishes its events in the same transaction.

const aggregatesSchema = "CREATE TABLE aggregates (id text PRIMARY KEY, version int NOT NULL);"

type fixture struct {
	brokers []string
	topic   string
	pool    *pgxpool.Pool
}

func newFixture(t *testing.T) fixture {
	t.Helper()
	brokers := chassistest.Brokers(t)
	url := chassistest.Database(t, Schema+aggregatesSchema)
	pool, err := pgxpool.New(t.Context(), url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	return fixture{brokers, chassistest.Topic(t, brokers), pool}
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

// command bumps the version of the aggregate and writes its events into the outbox, in one transaction; fail rolls the transaction back at the end.
func (f fixture) command(ctx context.Context, aggregate string, fail bool, events ...event.EventEnvelope) error {
	tx, err := f.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(context.WithoutCancel(ctx)) }()
	// The aggregate is locked before any write, so the transactions of one aggregate get their ids in the order of their changes.
	if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", aggregate); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, "INSERT INTO aggregates (id, version) VALUES ($1, 1) ON CONFLICT (id) DO UPDATE SET version = aggregates.version + 1", aggregate); err != nil {
		return err
	}
	if err := Publish(ctx, tx, f.topic, events...); err != nil {
		return err
	}
	if fail {
		return nil
	}
	return tx.Commit(ctx)
}

// run starts a forwarder that connects to Kafka with connect, and returns the function that stops it.
func (f fixture) run(t *testing.T, connect func() (message.Publisher, error)) (fwd *Forwarder, stop func()) {
	t.Helper()
	fwd, err := newForwarder(f.pool, connect, slog.New(slog.DiscardHandler), prometheus.NewRegistry())
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(t.Context())
	done := make(chan error, 1)
	go func() { done <- fwd.Run(ctx) }()
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
	return fwd, stop
}

func (f fixture) kafka(t *testing.T) func() (message.Publisher, error) {
	return func() (message.Publisher, error) { return event.NewPublisher(f.brokers, slog.New(slog.DiscardHandler)) }
}

// read reads the topic until every event in want has arrived, and returns the envelopes read in the order of their partition.
func (f fixture) read(t *testing.T, want ...event.EventEnvelope) []received {
	t.Helper()
	var got []received
	chassistest.Read(t, f.brokers, f.topic, 60*time.Second, func(records []chassistest.Record) bool {
		got = got[:0]
		for _, r := range records {
			var e event.EventEnvelope
			if err := json.Unmarshal(r.Value, &e); err != nil {
				t.Fatal(err)
			}
			got = append(got, received{e, r.Key})
		}
		for _, w := range want {
			if !slices.ContainsFunc(got, func(r received) bool { return r.EventId == w.EventId }) {
				return false
			}
		}
		return true
	})
	return got
}

type received struct {
	event.EventEnvelope
	key string
}

// waitSent waits until the Forwarder has marked every row as sent, which it does just after Kafka acknowledges them: stopped earlier, it would leave them pending.
func waitSent(t *testing.T, fwd *Forwarder) {
	t.Helper()
	chassistest.Eventually(t, 30*time.Second, "every row is marked as sent", func() bool {
		if err := fwd.measure(t.Context()); err != nil {
			t.Fatal(err)
		}
		return testutil.ToFloat64(fwd.pending) == 0
	})
}

func (f fixture) rows(t *testing.T) int {
	t.Helper()
	var n int
	if err := f.pool.QueryRow(t.Context(), `SELECT count(*) FROM watermill_outbox`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func TestCommittedEventReachesKafkaKeyedByItsAggregate(t *testing.T) {
	f := newFixture(t)
	e := something(watermill.NewUUID())
	if err := f.command(t.Context(), e.AggregateId, false, e); err != nil {
		t.Fatal(err)
	}

	f.run(t, f.kafka(t))

	for _, r := range f.read(t, e) {
		if r.key != r.AggregateId {
			t.Errorf("event %s has key %q, want its aggregate %q", r.EventId, r.key, r.AggregateId)
		}
	}
}

func TestRolledBackTransactionLeavesNoRowAndPublishesNothing(t *testing.T) {
	f := newFixture(t)
	aggregate := watermill.NewUUID()
	rolledBack, committed := something(aggregate), something(aggregate)
	if err := f.command(t.Context(), aggregate, true, rolledBack); err != nil {
		t.Fatal(err)
	}
	if n := f.rows(t); n != 0 {
		t.Fatalf("the rolled back transaction left %d rows in the outbox, want 0", n)
	}
	if err := f.command(t.Context(), aggregate, false, committed); err != nil {
		t.Fatal(err)
	}

	f.run(t, f.kafka(t))

	for _, r := range f.read(t, committed) {
		if r.EventId == rolledBack.EventId {
			t.Fatal("the event of the rolled back transaction reached Kafka")
		}
	}
}

func TestCleanupDeletesOnlyTheOldSentRows(t *testing.T) {
	f := newFixture(t)
	aggregate := watermill.NewUUID()
	sent, pending := something(aggregate), something(aggregate)
	if err := f.command(t.Context(), aggregate, false, sent); err != nil {
		t.Fatal(err)
	}
	fwd, stop := f.run(t, f.kafka(t))
	f.read(t, sent)
	waitSent(t, fwd)
	stop()
	if err := f.command(t.Context(), aggregate, false, pending); err != nil {
		t.Fatal(err)
	}

	if err := fwd.deleteSent(t.Context(), time.Hour); err != nil {
		t.Fatal(err)
	}
	if n := f.rows(t); n != 2 {
		t.Fatalf("the cleanup of the rows older than an hour left %d rows, want both recent ones", n)
	}
	if err := fwd.deleteSent(t.Context(), 0); err != nil {
		t.Fatal(err)
	}
	if n := f.rows(t); n != 1 {
		t.Fatalf("the cleanup left %d rows, want only the pending one", n)
	}
	if err := fwd.measure(t.Context()); err != nil {
		t.Fatal(err)
	}
	if n := testutil.ToFloat64(fwd.pending); n != 1 {
		t.Fatalf("pending events = %v after the cleanup, want 1", n)
	}
}

func TestMetricsCountThePendingEventsAndTheAgeOfTheOldest(t *testing.T) {
	f := newFixture(t)
	aggregate := watermill.NewUUID()
	first, second := something(aggregate), something(aggregate)
	for _, e := range []event.EventEnvelope{first, second} {
		if err := f.command(t.Context(), aggregate, false, e); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := f.pool.Exec(t.Context(), `UPDATE watermill_outbox SET created_at = created_at - interval '1 minute'`); err != nil {
		t.Fatal(err)
	}
	// Nothing has connected to Kafka yet, so the outbox has no offset: every row is pending.
	fwd, err := newForwarder(f.pool, f.kafka(t), slog.New(slog.DiscardHandler), prometheus.NewRegistry())
	if err != nil {
		t.Fatal(err)
	}
	if err := fwd.measure(t.Context()); err != nil {
		t.Fatal(err)
	}
	if n := testutil.ToFloat64(fwd.pending); n != 2 {
		t.Errorf("pending events = %v, want 2", n)
	}
	if age := testutil.ToFloat64(fwd.oldest); age < 60 {
		t.Errorf("age of the oldest pending event = %vs, want at least 60s", age)
	}

	fwd, stop := f.run(t, f.kafka(t))
	f.read(t, first, second)
	waitSent(t, fwd)
	stop()
	if err := fwd.measure(t.Context()); err != nil {
		t.Fatal(err)
	}
	if n := testutil.ToFloat64(fwd.pending); n != 0 {
		t.Errorf("pending events = %v once sent, want 0", n)
	}
	if age := testutil.ToFloat64(fwd.oldest); age != 0 {
		t.Errorf("age of the oldest pending event = %vs once sent, want 0", age)
	}
}

// A topic name that Kafka would refuse would hold up every event after it, so the command fails instead.
func TestPublishRefusesATopicKafkaWouldRefuse(t *testing.T) {
	f := newFixture(t)
	e := something(watermill.NewUUID())
	f.topic = "account/events"
	if err := f.command(t.Context(), e.AggregateId, false, e); err == nil {
		t.Fatal("the command committed an event for a topic Kafka would refuse")
	}
	if n := f.rows(t); n != 0 {
		t.Fatalf("the outbox has %d rows, want none", n)
	}
}

// A Forwarder stopped while it starts, as a service is when it shuts down at once, returns no error.
func TestRunStoppedAtOnceReturnsNoError(t *testing.T) {
	f := newFixture(t)
	fwd, err := newForwarder(f.pool, f.kafka(t), slog.New(slog.DiscardHandler), prometheus.NewRegistry())
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	if err := fwd.Run(ctx); err != nil {
		t.Fatalf("Run stopped at once: %v", err)
	}
}

// A Forwarder whose metrics cannot all be registered leaves none of them behind, since nothing would update them.
func TestNewForwarderLeavesNoMetricWhenOneCannotBeRegistered(t *testing.T) {
	registry := prometheus.NewRegistry()
	registry.MustRegister(prometheus.NewGauge(prometheus.GaugeOpts{Name: "outbox_oldest_pending_event_age_seconds", Help: "Registered by someone else."}))
	if _, err := newForwarder(nil, nil, slog.New(slog.DiscardHandler), registry); err == nil {
		t.Fatal("newForwarder succeeded with a metric already registered")
	}
	families, err := registry.Gather()
	if err != nil {
		t.Fatal(err)
	}
	for _, f := range families {
		if f.GetName() == "outbox_pending_events" {
			t.Fatal("outbox_pending_events stayed registered")
		}
	}
}

// Schema must create the tables that watermill-sql creates for itself, which a new release of the library could change.
func TestSchemaIsTheStandardSchemaOfWatermill(t *testing.T) {
	ours, err := pgx.Connect(t.Context(), chassistest.Database(t, Schema))
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = ours.Close(context.WithoutCancel(t.Context())) }()
	standard, err := pgxpool.New(t.Context(), chassistest.Database(t, ""))
	if err != nil {
		t.Fatal(err)
	}
	defer standard.Close()
	subscriber, err := sql.NewSubscriber(sql.BeginnerFromPgx(standard), subscriberConfig(), nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := subscriber.SubscribeInitialize(outboxTopic); err != nil {
		t.Fatal(err)
	}

	if got, want := columns(t, ours), columns(t, standard); !slices.Equal(got, want) {
		t.Fatalf("Schema creates\n%v\nwatermill-sql creates\n%v", got, want)
	}
}

// columns describes each column and each index, the primary keys included, of the tables of db.
func columns(t *testing.T, db interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
}) []string {
	t.Helper()
	rows, err := db.Query(t.Context(), `SELECT table_name || '.' || column_name || ' ' || data_type || coalesce('(' || character_maximum_length || ')', '') || ' ' || is_nullable || ' ' || coalesce(column_default, '')
		FROM information_schema.columns WHERE table_schema = 'public'
		UNION ALL SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY 1`)
	if err != nil {
		t.Fatal(err)
	}
	described, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		t.Fatal(err)
	}
	return described
}
