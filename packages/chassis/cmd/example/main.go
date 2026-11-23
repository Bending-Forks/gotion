package main

import (
	"context"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Bending-Forks/gotion/packages/chassis/config"
	"github.com/Bending-Forks/gotion/packages/chassis/health"
	"github.com/Bending-Forks/gotion/packages/chassis/logging"
	"github.com/Bending-Forks/gotion/packages/chassis/metrics"
	"github.com/Bending-Forks/gotion/packages/chassis/server"
)

func main() {
	logger := logging.New("chassis-example")
	addr, err := config.HTTPAddr()
	if err != nil {
		logger.Error("read configuration", "error", err)
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		logger.Error("listen for HTTP", "error", err)
		os.Exit(1)
	}

	m := metrics.New()
	mux := http.NewServeMux()
	health.Register(mux)
	mux.Handle("GET /metrics", m.Handler())
	mux.Handle("GET /{$}", m.Instrument("example", http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})))
	srv := &http.Server{
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		ErrorLog:          slog.NewLogLogger(logger.Handler(), slog.LevelError),
	}
	logger.Info("HTTP server listening", "addr", listener.Addr().String())
	if err := server.Serve(ctx, srv, listener); err != nil {
		logger.Error("HTTP server failed", "error", err)
		os.Exit(1)
	}
	logger.Info("HTTP server stopped")
}
