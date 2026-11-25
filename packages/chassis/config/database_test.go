package config_test

import (
	"testing"

	"github.com/Bending-Forks/gotion/packages/chassis/config"
)

func TestDatabaseURL(t *testing.T) {
	t.Run("configured URL", func(t *testing.T) {
		t.Setenv("DATABASE_URL", "postgres://account:secret@account-db:5432/account")
		url, err := config.DatabaseURL()
		if err != nil || url != "postgres://account:secret@account-db:5432/account" {
			t.Fatalf("DatabaseURL = %q, %v", url, err)
		}
	})
	t.Run("missing URL", func(t *testing.T) {
		t.Setenv("DATABASE_URL", "")
		if _, err := config.DatabaseURL(); err == nil {
			t.Fatal("DatabaseURL without DATABASE_URL succeeded")
		}
	})
}
