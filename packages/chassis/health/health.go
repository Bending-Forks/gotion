package health

import (
	"context"
	"net/http"
)

// Register adds the Kubernetes probes to mux. Readiness checks run with the request context.
func Register(mux *http.ServeMux, checks ...func(context.Context) error) {
	mux.HandleFunc("GET /health/live", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	mux.HandleFunc("GET /health/ready", func(w http.ResponseWriter, r *http.Request) {
		for _, check := range checks {
			if check(r.Context()) != nil {
				w.WriteHeader(http.StatusServiceUnavailable)
				return
			}
		}
		w.WriteHeader(http.StatusOK)
	})
}
