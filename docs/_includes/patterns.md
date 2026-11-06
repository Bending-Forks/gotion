## Patterns

The microservice patterns Gotion applies, gathered in one place. Most of them are described where the decision that needs them is taken; the table names the problem each one solves and links to that description. Observability has no other place in the design, so it is described below.

| Pattern | Where | Problem it solves | Described in |
|---|---|---|---|
| Decompose by subdomain | Every service | A change to one model stays in one service (QA-09), each service migrates only its own schema (QA-08), a crash of Editing leaves the other services working (QA-04) | [Decomposition](#decomposition) |
| Database per Service | Every service | No store is shared, so no schema change concerns two services (QA-08, QA-09) | [Repository view](#components-and-connectors) |
| API Gateway | Entry point of the client | One place authenticates every request and routes it, the WebSocket of a page to the instance of Editing that owns it | [Components and Connectors](#components-and-connectors) |
| Access Token | Gateway, Account | The gateway checks the identity on every request without calling Account; the token carries no role, so a change of role needs no new token (QA-06) | [ADR-03](#adr-03-editing-keeps-a-local-copy-of-the-roles-account-and-discussion-ask-membership) |
| Domain Events on a publish-subscribe channel | Every upstream context, through Kafka | A context reacts to another without the producer waiting for it, or knowing who listens | [Event-based view](#components-and-connectors), [Contracts](#contracts) |
| Event Sourcing | Editing | An edit is acknowledged after one durable append, within QA-01, and survives a crash (QA-04) | [ADR-02](#adr-02-editing-acknowledges-an-operation-once-it-is-in-a-durable-log) |
| CQRS view of another context (Event-Carried State Transfer) | Editing, local copy of the roles | Editing checks the role of every edit without a call to Membership on the path of the ack (QA-01), and keeps working while Membership is down | [ADR-03](#adr-03-editing-keeps-a-local-copy-of-the-roles-account-and-discussion-ask-membership) |
| Remote Procedure Invocation | The four queries between services | A command checks data owned by another context before it runs | [Dependencies at run time](#dependencies-at-run-time) |
| Circuit Breaker, with timeout and one retry | The adapters of those queries | A callee that is down costs a quick refusal instead of a timeout on every command, and a failure always refuses (QA-06) | [Dependencies at run time](#dependencies-at-run-time) |
| Idempotent Consumer | Every Kafka consumer | Kafka delivers an event at least once, and a repeated one must change nothing | [Contracts](#contracts) |
| Consumer-driven contract test | The pipeline of each producer | A change that breaks a consumer, in the same language or the other one (ADR-04), fails before it is merged | [Contracts](#contracts) |
| Single writer per page, routed by a fixed hash | Editing, StatefulSet | Every operation of a page goes through one relay (ADR-01), with no table of assignments to keep | [State and scaling](#state-and-scaling) |
| Health Check API | Every service | Kubernetes restarts an instance that is stuck and sends traffic only to one that is ready (QA-04) | [Observability](#observability) |
| Application Metrics | Every service and the client | The runtime scenarios are measured while the system runs (QA-01 to QA-04) | [Observability](#observability) |

<!-- TODO: the delivery of the events from a change of state to Kafka (Transactional Outbox),
promised in Dependencies at run time, and how the cascades across contexts run without a saga. -->

### Observability

The quality attribute scenarios of Analysis set the targets; observability is how the running system shows whether it meets them. Every service, on Go and on Node.js alike, exposes two endpoints next to its API: a health check and its metrics. Both are adapters of the hexagon, so the domain knows neither Kubernetes nor Prometheus.

**Health Check API.** Each service answers two checks, which Kubernetes polls (with Compose, the `healthcheck` of each container calls the second one):

- **Liveness**, `/health/live`, answers as long as the process can serve a request at all. It checks no dependency: if the database is down, restarting the service does not bring it back, and it would restart every service at once. A failed liveness check makes Kubernetes restart the instance.
- **Readiness**, `/health/ready`, answers only when the instance can do its work: its database and Kafka are reachable, and for Editing, the session logs of its pages have been replayed from the last snapshot (ADR-02). Until then Kubernetes sends it no traffic, so the gateway does not forward a WebSocket to an instance that would serve a page without its latest operations. The time from a crash to the instance being ready again is the recovery time of QA-04.

Readiness does not include the services a service queries. A Membership that is down makes the commands that need it fail closed, through the circuit breaker ([Dependencies at run time](#dependencies-at-run-time)); if it also made its callers not ready, a crash of Membership would stop the editing of every page, which ADR-03 avoids.

**Application Metrics.** Each service exposes its metrics in the Prometheus format on `/metrics`, and Prometheus pulls them ([Components and Connectors](#components-and-connectors)). They are collected in the adapters, where requests come in and acks and events go out. Each service exposes the rate, the errors and the duration of the requests of each of its adapters, the state of its circuit breakers, and the metrics below, which measure a scenario:

| Scenario | Metric | Measured in |
|---|---|---|
| QA-01, local render | Histogram of the time from a keystroke to the next frame that shows it | The client |
| QA-01, acknowledgement | Histogram of the time from submitting an operation to its ack | The client, for the round trip the user waits for; Editing, for the time from receiving it to the ack, without the network |
| QA-02 | Histogram of the time from the ack of an operation to its render in another client, labelled with the number of editors on the page | The client that renders it, corrected for the offset between its clock and the server's |
| QA-03 | Histogram of the time from opening a page to the page accepting input, with a cold cache | The client, and a probe that opens a page of reference |
| QA-04 | Restarts of each instance; time to replay the session logs; time from a crash to readiness | Every service; Editing |
| QA-06 | Lag from the publication of an event of Membership to its application in the local copy of the roles | Editing |
| QA-07 | Failed sign-ins and throttled sign-ins | Account |

The client measures what only the client sees and sends its measures in batches to a REST endpoint of Editing kept for them, through the gateway, and Editing exposes them with its own. The measures stay off the WebSocket of the session, so they never queue in front of the operations whose latency they measure, and a page that is not open can still report them. Each histogram has a bucket at the threshold of its scenario, such as 0.5 s for the ack of QA-01 and 0.3 s and 1 s for QA-02, so the share of events within the threshold is read straight from the buckets. No metric is labelled with the identity of a page, a user or a workspace, so their number of series stays fixed as the workspace grows. The SLOs built on these metrics, their dashboards and alerts are in [Monitoring](implementation.html#monitoring).

**Left out.** Log aggregation, distributed tracing, exception tracking and audit logging are not part of the prototype: no scenario depends on them. Each service writes structured logs to its standard output, which the container runtime keeps. Tracing would be the first to add, to follow a command through the events it causes.
