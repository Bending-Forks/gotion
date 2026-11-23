package server

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"time"
)

// Serve runs srv and gives in-flight requests up to ten seconds to finish when ctx is canceled.
func Serve(ctx context.Context, srv *http.Server, listener net.Listener) error {
	ctx, stop := context.WithCancel(ctx)
	defer stop()

	shutdown := make(chan error)
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 10*time.Second)
		err := srv.Shutdown(shutdownCtx)
		cancel()
		if err != nil {
			err = errors.Join(fmt.Errorf("shutdown HTTP server: %w", err), srv.Close())
		}
		shutdown <- err
	}()

	err := srv.Serve(listener)
	stop()
	shutdownErr := <-shutdown
	if errors.Is(err, http.ErrServerClosed) {
		return shutdownErr
	}
	return errors.Join(fmt.Errorf("serve HTTP: %w", err), shutdownErr)
}
