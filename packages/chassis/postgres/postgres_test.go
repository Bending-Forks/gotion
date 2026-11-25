package postgres_test

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"slices"
	"sync"
	"testing"
	"testing/fstest"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Bending-Forks/gotion/packages/chassis/postgres"
)

// Integration test against a real PostgreSQL: TEST_DATABASE_URL names a server where the test may create and drop a database.
func TestOpenAppliesEachMigrationOnceWhenTwoInstancesStartTogether(t *testing.T) {
	server := os.Getenv("TEST_DATABASE_URL")
	if server == "" {
		t.Skip("TEST_DATABASE_URL is not set")
	}
	ctx := t.Context()
	dbURL := emptyDatabase(t, server)

	// A migration that fails if it runs twice, and a pause longer than the 1 s goose waits before it retries creating its version table, so that the second instance arrives while the first is migrating.
	migrations := fstest.MapFS{"00001_first.sql": {Data: []byte("-- +goose Up\nSELECT pg_sleep(2);\nCREATE TABLE first (id int);\n")}}

	var wg sync.WaitGroup
	pools := make([]*pgxpool.Pool, 2)
	errs := make([]error, 2)
	for i := range 2 {
		wg.Go(func() { pools[i], errs[i] = postgres.Open(ctx, dbURL, migrations) })
	}
	wg.Wait()
	for i := range 2 {
		if errs[i] != nil {
			t.Fatalf("instance %d: Open: %v", i, errs[i])
		}
		t.Cleanup(pools[i].Close)
	}

	rows, err := pools[0].Query(ctx, "SELECT version_id FROM goose_db_version WHERE version_id > 0 ORDER BY id")
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
