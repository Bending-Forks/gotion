## Architecture

### Components and Connectors

<!-- TODO: Components-and-Connectors view of the microservices and their connectors. -->

<!-- TODO SLO: include the monitoring infrastructure as components: Prometheus, which pulls
the metrics from every service (a pull connector), and Grafana, which reads them from
Prometheus. -->

### Hexagonal Architecture

<!-- TODO: the internal architecture shared by every service: domain model at the centre,
ports for the repositories and the events, adapters for HTTP, the database and the broker. -->

<!-- TODO SLO: the metrics are collected in the adapters (HTTP, WebSocket), where requests
come in and acknowledgements go out, so the domain model does not depend on Prometheus. -->
