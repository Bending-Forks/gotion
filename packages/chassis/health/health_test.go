package health_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Bending-Forks/gotion/packages/chassis/health"
)

func TestProbes(t *testing.T) {
	t.Parallel()

	for _, tt := range []struct {
		name      string
		path      string
		checkErr  error
		want      int
		wantCalls int
	}{
		{name: "liveness skips checks", path: "/health/live", checkErr: errors.New("database detail"), want: http.StatusOK},
		{name: "readiness runs every check", path: "/health/ready", want: http.StatusOK, wantCalls: 2},
		{name: "readiness fails on a failed check", path: "/health/ready", checkErr: errors.New("database detail"), want: http.StatusServiceUnavailable, wantCalls: 2},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, tt.path, nil)
			calls := 0
			mux := http.NewServeMux()
			health.Register(mux, func(ctx context.Context) error {
				if ctx != req.Context() {
					t.Error("first check did not receive the request context")
				}
				calls++
				return nil
			}, func(ctx context.Context) error {
				if ctx != req.Context() {
					t.Error("second check did not receive the request context")
				}
				calls++
				return tt.checkErr
			})

			rec := httptest.NewRecorder()
			mux.ServeHTTP(rec, req)
			if rec.Code != tt.want || calls != tt.wantCalls {
				t.Fatalf("status = %d, checks run = %d; want %d, %d", rec.Code, calls, tt.want, tt.wantCalls)
			}
			if strings.Contains(rec.Body.String(), "database detail") {
				t.Fatal("probe exposed the dependency error")
			}
		})
	}
}
