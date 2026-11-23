package metrics

import (
	"net/http"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Metrics records completed HTTP requests in a service-local Prometheus registry.
type Metrics struct {
	registry *prometheus.Registry
	requests *prometheus.CounterVec
	duration *prometheus.HistogramVec
}

// New sets up the HTTP request collectors.
func New() *Metrics {
	m := &Metrics{
		registry: prometheus.NewRegistry(),
		requests: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Completed HTTP requests by adapter and status code.",
		}, []string{"adapter", "code"}),
		duration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Name: "http_request_duration_seconds",
			Help: "HTTP request duration by adapter in seconds.",
		}, []string{"adapter"}),
	}
	m.registry.MustRegister(m.requests, m.duration)
	return m
}

// Instrument records request count, HTTP status and duration. Adapter is a fixed name chosen at startup.
func (m *Metrics) Instrument(adapter string, next http.Handler) http.Handler {
	labels := prometheus.Labels{"adapter": adapter}
	timed := promhttp.InstrumentHandlerDuration(m.duration.MustCurryWith(labels), next)
	return promhttp.InstrumentHandlerCounter(m.requests.MustCurryWith(labels), timed)
}

// Handler returns the Prometheus scrape handler for /metrics.
func (m *Metrics) Handler() http.Handler {
	return promhttp.HandlerFor(m.registry, promhttp.HandlerOpts{})
}
