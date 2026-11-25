package postgres

import (
	"context"
	"fmt"
	"io/fs"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/pressly/goose/v3/lock"
)

// Open connects to the database at url and applies the migrations of migrations not applied yet, goose SQL files at its root (ADR-06).
// They run under a PostgreSQL advisory lock: an instance that starts while another one is migrating waits for the lock, then finds nothing left to run.
// The pool's Ping is the readiness check of the database: health.Register(mux, pool.Ping).
func Open(ctx context.Context, url string, migrations fs.FS) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, fmt.Errorf("open the database pool: %w", err)
	}
	if err := migrate(ctx, pool, migrations); err != nil {
		pool.Close()
		return nil, err
	}
	return pool, nil
}

func migrate(ctx context.Context, pool *pgxpool.Pool, migrations fs.FS) error {
	// Try the lock every second instead of every 5 s, still for at most 5 min, so a waiting instance starts soon after the migration ends.
	locker, err := lock.NewPostgresSessionLocker(lock.WithLockTimeout(1, 300))
	if err != nil {
		return fmt.Errorf("create the migration lock: %w", err)
	}
	// Closing db leaves the pool open.
	db := stdlib.OpenDBFromPool(pool)
	defer db.Close()
	provider, err := goose.NewProvider(goose.DialectPostgres, db, migrations, goose.WithSessionLocker(locker))
	if err != nil {
		return fmt.Errorf("load the migrations: %w", err)
	}
	if _, err := provider.Up(ctx); err != nil {
		return fmt.Errorf("apply the migrations: %w", err)
	}
	return nil
}
