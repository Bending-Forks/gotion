package server_test

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"testing"
	"time"

	"github.com/Bending-Forks/gotion/packages/chassis/server"
)

func TestServeDrainsInFlightRequest(t *testing.T) {
	t.Parallel()
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()
	serveCtx, shutdown := context.WithCancel(ctx)
	defer shutdown()

	listener := listen(t)
	started, release, shuttingDown := make(chan struct{}), make(chan struct{}), make(chan struct{})
	srv := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		close(started)
		select {
		case <-release:
			w.WriteHeader(http.StatusNoContent)
		case <-r.Context().Done():
		}
	})}
	srv.RegisterOnShutdown(func() { close(shuttingDown) })
	served := make(chan error, 1)
	go func() { served <- server.Serve(serveCtx, srv, listener) }()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://"+listener.Addr().String(), nil)
	if err != nil {
		t.Fatal(err)
	}
	requested := make(chan error, 1)
	go func() {
		resp, err := http.DefaultClient.Do(req)
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode != http.StatusNoContent {
				err = fmt.Errorf("request returned %d", resp.StatusCode)
			}
		}
		requested <- err
	}()

	waitFor(t, ctx, started, "request start")
	shutdown()
	waitFor(t, ctx, shuttingDown, "server shutdown")
	select {
	case err := <-served:
		t.Fatalf("Serve returned before the request finished: %v", err)
	default:
	}

	close(release)
	for _, done := range []<-chan error{requested, served} {
		select {
		case err := <-done:
			if err != nil {
				t.Error(err)
			}
		case <-ctx.Done():
			t.Fatal(ctx.Err())
		}
	}
}

func TestServeReturnsListenerFailure(t *testing.T) {
	t.Parallel()
	listener := listen(t)
	if err := listener.Close(); err != nil {
		t.Fatal(err)
	}
	if err := server.Serve(t.Context(), &http.Server{}, listener); !errors.Is(err, net.ErrClosed) {
		t.Fatalf("Serve = %v; want closed listener error", err)
	}
}

func listen(t *testing.T) net.Listener {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { listener.Close() })
	return listener
}

func waitFor(t *testing.T, ctx context.Context, done <-chan struct{}, event string) {
	t.Helper()
	select {
	case <-done:
	case <-ctx.Done():
		t.Fatalf("waiting for %s: %v", event, ctx.Err())
	}
}
