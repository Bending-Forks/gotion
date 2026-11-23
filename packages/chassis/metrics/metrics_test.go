package metrics_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Bending-Forks/gotion/packages/chassis/metrics"
)

func TestHTTPMetrics(t *testing.T) {
	t.Parallel()

	m := metrics.New()
	api := m.Instrument("api", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			w.WriteHeader(http.StatusInternalServerError)
		}
	}))
	query := m.Instrument("query", http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	api.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))
	api.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/pages/page-id", nil))
	query.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))

	rec := httptest.NewRecorder()
	m.Handler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/metrics", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("scrape returned %d", rec.Code)
	}
	for _, want := range []string{
		`http_requests_total{adapter="api",code="200"} 1`,
		`http_requests_total{adapter="api",code="500"} 1`,
		`http_requests_total{adapter="query",code="204"} 1`,
		`# TYPE http_request_duration_seconds histogram`,
		`http_request_duration_seconds_count{adapter="api"} 2`,
		`http_request_duration_seconds_count{adapter="query"} 1`,
	} {
		if !strings.Contains(rec.Body.String(), want) {
			t.Errorf("scrape missing %q", want)
		}
	}
	if strings.Contains(rec.Body.String(), "page-id") {
		t.Error("metrics exposed a request URL")
	}
}
