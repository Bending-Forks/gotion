package config

import (
	"errors"
	"os"
)

// DatabaseURL reads the connection URL of the service's PostgreSQL from DATABASE_URL, which has no default.
func DatabaseURL() (string, error) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		return "", errors.New("DATABASE_URL is not set")
	}
	return url, nil
}
