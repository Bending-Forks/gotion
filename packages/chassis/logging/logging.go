package logging

import (
	"log/slog"
	"os"
)

// New returns a structured logger for service that writes JSON to stdout.
func New(service string) *slog.Logger {
	return slog.New(slog.NewJSONHandler(os.Stdout, nil)).With("service", service)
}
