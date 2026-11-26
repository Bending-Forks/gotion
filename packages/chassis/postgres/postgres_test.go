package postgres_test

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"slices"
	"testing"
	"testing/fstest"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pressly/goose/v3/lock"

	"github.com/Bending-Forks/gotion/packages/chassis/postgres"
)

// Integration test against a real PostgreSQL: TEST_DATABASE_URL names a server where the test may create and drop a database.
// A session of the test holds the migration lock, as an instance still migrating would: Open must try the lock, wait without migrating, and migrate once the lock is free.
func TestOpenMigratesOnlyUnderTheLock(t *testing.T) {
	server := os.Getenv("TEST_DATABASE_URL")
	if server == "" {
		t.Skip("TEST_DATABASE_URL is not set")
	}
	ctx := t.Context()
	dbURL := emptyDatabase(t, server)
	migrations := fstest.MapFS{"00001_first.sql": {Data: []byte("-- +goose Up\nCREATE TABLE first (id int);\n")}}

	holder, err := pgx.Connect(ctx, dbURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = holder.Close(context.WithoutCancel(ctx)) })
	// Open takes goose's default lock, which is scoped to the database.
	if _, err := holder.Exec(ctx, "SELECT pg_advisory_lock($1)", lock.DefaultLockID); err != nil {
		t.Fatal(err)
	}

	type opened struct {
		pool *pgxpool.Pool
		err  error
	}
	done := make(chan opened, 1)
	go func() {
		pool, err := postgres.Open(ctx, dbURL, migrations)
		done <- opened{pool, err}
	}()

	// Wait until another session of the database has asked for the lock: goose tries it once a second.
	for tried := false; !tried; {
		select {
		case o := <-done:
			t.Fatalf("Open returned while another session held the migration lock (err: %v)", o.err)
		case <-time.After(100 * time.Millisecond):
		}
		err := holder.QueryRow(ctx, "SELECT EXISTS (SELECT FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid() AND query LIKE 'SELECT pg_try_advisory_lock%')").Scan(&tried)
		if err != nil {
			t.Fatal(err)
		}
	}
	var pending bool
	if err := holder.QueryRow(ctx, "SELECT to_regclass('first') IS NULL").Scan(&pending); err != nil {
		t.Fatal(err)
	}
	if !pending {
		t.Fatal("Open migrated while another session held the migration lock")
	}

	if _, err := holder.Exec(ctx, "SELECT pg_advisory_unlock($1)", lock.DefaultLockID); err != nil {
		t.Fatal(err)
	}
	o := <-done
	if o.err != nil {
		t.Fatalf("Open: %v", o.err)
	}
	t.Cleanup(o.pool.Close)

	rows, err := o.pool.Query(ctx, "SELECT version_id FROM goose_db_version WHERE version_id > 0 ORDER BY id")
	if err != nil {
		t.Fatal(err)
	}
	versions, err := pgx.CollectRows(rows, pgx.RowTo[int64])
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(versions, []int64{1}) {
		t.Fatalf("applied versions = %v, want [1]", versions)
	}
}

// emptyDatabase creates a database on server, drops it at the end of the test and returns its URL.
func emptyDatabase(t *testing.T, server string) string {
	t.Helper()
	ctx := t.Context()
	admin, err := pgx.Connect(ctx, server)
	if err != nil {
		t.Fatal(err)
	}
	name := fmt.Sprintf("chassis_test_%d", time.Now().UnixNano())
	if _, err := admin.Exec(ctx, "CREATE DATABASE "+name); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		// t.Context() is cancelled before the cleanup runs.
		ctx := context.WithoutCancel(ctx)
		if _, err := admin.Exec(ctx, "DROP DATABASE "+name+" WITH (FORCE)"); err != nil {
			t.Error(err)
		}
		_ = admin.Close(ctx)
	})
	u, err := url.Parse(server)
	if err != nil {
		t.Fatal(err)
	}
	u.Path = "/" + name
	return u.String()
}
