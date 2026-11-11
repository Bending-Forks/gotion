## Patterns

The microservice patterns Gotion applies, gathered in one place. Most of them are described where the decision that needs them is taken; the table names the problem each one solves and links to that description. Observability has no other place in the design, so it is described below.

| Category | Pattern | Where | Problem it solves | Described in |
|---|---|---|---|---|
| Decomposition | Decompose by subdomain | Every service | A change to one model stays in one service (QA-09), each service migrates only its own schema (QA-08), a crash of Editing leaves the other services working (QA-04) | [Decomposition](#decomposition) |
| Data management | Database per Service | Every service | No store is shared, so no schema change concerns two services (QA-08, QA-09) | [Repository view](#components-and-connectors) |
| Data management | Aggregate | Every bounded context | One command changes one aggregate in one transaction, so each invariant is checked in one place and no transaction spans two services | [Tactical Design](#tactical-design) |
| Data management | Domain Event | Every upstream context | A context reacts to a change in another without the producer knowing who listens | [Event-based view](#components-and-connectors), [Contracts](#contracts) |
| Data management | Event Sourcing | Editing | An edit is acknowledged after one durable append, within QA-01, and survives a crash (QA-04) | [ADR-02](#adr-02-editing-acknowledges-an-operation-once-it-is-in-a-durable-log) |
| Querying | CQRS | Editing, local copy of the roles | Editing checks the role of every edit without a call to Membership on the path of the ack (QA-01), and keeps working while Membership is down | [ADR-03](#adr-03-editing-keeps-a-local-copy-of-the-roles-account-and-discussion-ask-membership) |
| Communication | Messaging | Every upstream context, through Kafka | The domain events reach their consumers without the producer waiting for them | [Event-based view](#components-and-connectors), [Event delivery](#event-delivery) |
| Communication | Remote Procedure Invocation | The four queries between services | A command checks data owned by another context before it runs | [Dependencies at run time](#dependencies-at-run-time) |
| Communication | Circuit Breaker | The adapters of those queries | A callee that is down costs a quick refusal instead of a timeout on every command, and a failure always refuses (QA-06) | [Dependencies at run time](#dependencies-at-run-time) |
| Communication | Idempotent Consumer | Every Kafka consumer | Kafka delivers an event at least once, and a repeated one must change nothing | [Contracts](#contracts) |
| Communication | API Gateway | Entry point of the client | One place authenticates every request and routes it, the WebSocket of a page to the instance of Editing that owns it | [Components and Connectors](#components-and-connectors), [State and scaling](#state-and-scaling) |
| Security | Access Token | Gateway, Account | The gateway checks the identity on every request without calling Account; the token carries no role, so a change of role needs no new token (QA-06) | [ADR-03](#adr-03-editing-keeps-a-local-copy-of-the-roles-account-and-discussion-ask-membership) |
| Testing | Consumer-driven contract test | The pipeline of each producer | A change that breaks a consumer, in the same language or the other one (ADR-04), fails before it is merged | [Contracts](#contracts) |
| Deployment | Service per container | Every service | Each service is built, shipped and restarted on its own, whatever its runtime (ADR-04) | TODO |
| Deployment | Service deployment platform | Kubernetes | The platform restarts, scales and routes the instances, with no script of our own (QA-04) | TODO |
| Observability | Health Check API | Every service | Kubernetes restarts an instance that is stuck and sends traffic only to one that is ready (QA-04) | [Observability](#observability) |
| Observability | Application Metrics | Every service and the client | The runtime scenarios are measured while the system runs (QA-01 to QA-04, QA-06, QA-07) | [Observability](#observability) |

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

### Event delivery

A command changes the state in the store of its service, and the event that tells the other contexts goes out on Kafka. The two are separate systems with no transaction across them, so the order of the two writes decides what a failure between them does.

**Publication after the commit** ([ADR-05](#adr-05-services-publish-their-events-after-the-commit)). Every service publishes an event only once the change of state that raises it is stored: Account, Membership and Discussion after the commit of their transaction, Editing after the operation is in the session log and applied to the Page Block Tree. An event is therefore never published for a change that was not stored. The Kafka producer of the service retries until Kafka acknowledges the event, so while the service runs, Kafka being down or a network fault only delays the event: it waits in memory and goes out when Kafka is back.

The event is lost if the service stops after the commit and before Kafka acknowledges it: in a crash, a few milliseconds after the commit, or at any time while Kafka is down and the events wait in memory. Nothing raises it again, so the policy downstream never runs for it. With Member Removed lost, Editing keeps letting the removed member edit, against QA-06; with Block Deleted lost, the comment threads of the block stay in Discussion. Gotion accepts this limit in the prototype: a [Transactional Outbox](#adr-05-services-publish-their-events-after-the-commit) would close it, and can be added later without changing the consumers or the contracts.

**Cascades without a saga.** Some commands set off a chain of policies in other contexts: Workspace Created makes Membership create the membership of the workspace and Editing its root page; Workspace Deleted makes both delete them, and Editing then publishes Page Deleted, which makes Discussion delete the threads. Each step is a local transaction of one service, started by the event of the step before, with no coordinator: a choreography. None of these steps can be refused by a rule of its context: creating the membership or the root page of a new workspace always succeeds, and deleting what is not there changes nothing. So no step ever has to undo the steps before it, and the cascade needs neither an orchestrator nor compensating transactions. Once an event is published, the at-least-once delivery of Kafka and the idempotent consumers make its step happen sooner or later, and until then the system is only eventually consistent: a deleted page keeps its comment threads for a while, within the bounds of the scenarios. A step whose event is lost as above never runs, and the cascade stops there. If a policy could one day be refused by a rule of its context, that cascade would become a saga with its compensations.
