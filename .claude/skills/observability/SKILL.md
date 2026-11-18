---
name: observability
description: Make a service observable and measurable - its health checks, technical and business metrics, the metrics that measure a quality attribute scenario, logs, externalized configuration, and the SLIs and SLOs of the scenarios. Use it for the server, health, config, logging and metrics packages of the Go chassis, the same concerns in Editing, Prometheus and Grafana, and any task that measures a QA scenario.
---

# Observability

The design is in *Observability* (`docs/_includes/patterns.md`): which checks each service answers, which metric measures which scenario, and what the prototype leaves out. Implement it as written there; a change goes back into that section in the same PR.

## Health checks

- Two endpoints, served by an adapter so the domain knows nothing of Kubernetes: `/health/live` and `/health/ready`.
- **Liveness** checks no dependency: restarting the service doesn't bring its database back.
- **Readiness** checks what the service can't serve without: its database; Kafka only in Editing, which publishes directly, and there also the replay of the session logs (ADR-02). Never the services it queries: the circuit breaker handles those.
- A check is cheap and changes nothing, such as a test query.

## Metrics

- `/metrics` in the Prometheus format, pulled by Prometheus.
- For each adapter: the rate, errors and duration of its requests. A duration is a histogram, so that percentiles can be computed: an SLO speaks of p95 or p99, never of an average.
- A **counter** only goes up (failed sign-ins), a **gauge** goes up and down (pending outbox events, open sessions), a **histogram** samples a distribution (time to ack).
- A business metric counts a fact of the domain. The application service or an adapter records it through a port; the domain never imports the metrics library.
- Labels take bounded values only (route, outcome), never the identity of a user, a page or a workspace.
- A metric that measures a scenario is listed in the table of *Observability*: adding one adds a row there.

## Logs and configuration

- JSON logs on the standard output (`log/slog` in Go, pino in Editing).
- Configuration comes only from environment variables, read in `main`: the same image runs in Compose, on kind and in the CI. No configuration or secret is baked into an image or committed.

## SLIs and SLOs of a scenario

1. Start from the scenario and the user journey it protects.
2. The SLI is the metric that tracks what the user experiences: a percentile of a latency, the share of successful requests.
3. The SLO is the target and its window, taken from the response measure of the scenario.
4. The dashboard and an alert on the error budget go into Grafana (*Monitoring* in `docs/implementation.md`).

A scenario whose target is 100 % is an invariant, checked by a test and not by an SLO (`test-strategy` skill).
