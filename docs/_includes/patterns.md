## Patterns

The microservice patterns Gotion applies, gathered in one place. Most of them are described where the decision that needs them is taken; the table names the problem each one solves and links to that description. Observability has no other place in the design, so it is described below.

| Category | Pattern | Where | Problem it solves | Described in |
|---|---|---|---|---|
| Decomposition | Decompose by subdomain | Every service | A change to one model stays in one service (QA-09), each service migrates only its own schema (QA-08), a crash of Editing leaves the other services working (QA-04) | [Decomposition](#decomposition) |
| Data management | Database per Service | Every service | No store is shared, so no schema change concerns two services (QA-08, QA-09) | [Repository view](#components-and-connectors) |
| Data management | Aggregate | Every bounded context | One command changes one aggregate in one transaction, so each invariant is checked in one place and no transaction spans two services | [Tactical Design](#tactical-design) |
| Data management | Domain Event | Every upstream context | A context reacts to a change in another without the producer knowing who listens | [Event-based view](#components-and-connectors), [Contracts](#contracts) |
| Data management | Event Sourcing | Editing | An edit is acknowledged after one durable append, within QA-01, and survives a crash (QA-04) | [ADR-02](#adr-02-editing-acknowledges-an-operation-once-it-is-in-a-durable-log) |
| Transactional messaging | Transactional Outbox | Account, Membership, Discussion | A committed change and its outgoing events survive a service restart together, including role revocations (QA-06) | [ADR-05](#adr-05-go-publishers-use-a-transactional-outbox-with-polling) |
| Transactional messaging | Polling Publisher | Account, Membership, Discussion | Pending events reach Kafka after an outage without adding a CDC connector | [Event delivery](#event-delivery), [ADR-05](#adr-05-go-publishers-use-a-transactional-outbox-with-polling) |
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

The quality attribute scenarios of Analysis set the targets; observability shows whether the running system meets them. Every service exposes a health check and its metrics next to its API, through adapters of the hexagon, so the domain knows neither Kubernetes nor Prometheus.

**Health Check API.** Each service answers two checks, which Kubernetes polls:

- **Liveness**, `/health/live`, answers as long as the process can serve a request. It checks no dependency, since restarting a service does not bring its database back. A failed check makes Kubernetes restart the instance.
- **Readiness**, `/health/ready`, requires a reachable database. Account, Membership and Discussion must be able to commit the state and outbox together, but do not require Kafka: their commands can enqueue events during an outage (ADR-05). Editing and Notification still require Kafka; Editing also waits for the session logs of its pages to be replayed (ADR-02). Until ready, the instance gets no traffic. The time from a crash to readiness is the recovery time of QA-04.

Readiness leaves out the services a service queries: a Membership that is down is handled by the circuit breaker ([Dependencies at run time](#dependencies-at-run-time)), and must not make Editing unready, which ADR-03 avoids.

**Application Metrics.** Each service exposes its metrics on `/metrics` in the Prometheus format, and Prometheus pulls them. Next to the rate, errors and duration of the requests of each adapter, these metrics measure a scenario:

| Scenario | Metric | Measured in |
|---|---|---|
| QA-01 | Time from a keystroke to its render; time from an operation to its ack | The client; Editing |
| QA-02 | Time from the ack of an operation to its render in another client | The client |
| QA-03 | Time from opening a page to the page accepting input | The client |
| QA-04 | Restarts; time to replay the session logs; time from a crash to readiness | Every service; Editing |
| QA-06 | Lag from the change in Membership to its application in the local copy of the roles, including the wait in the outbox | Membership; Editing |
| QA-07 | Failed and throttled sign-ins | Account |

The client sends its measures to Editing through the gateway, off the WebSocket of the session, so they never delay the operations they measure. The dashboards and alerts are in [Monitoring](implementation.html#monitoring).

Account, Membership and Discussion also expose the number of pending outbox events and the age of the oldest one, so a stopped publisher or a Kafka outage is visible even when no event reaches a consumer.

Log aggregation, distributed tracing, exception tracking and audit logging are left out of the prototype, since no scenario depends on them; each service writes structured logs to its standard output.

### Event delivery

A command changes the store of its service and publishes an event on Kafka. No transaction spans a database and Kafka, so each service keeps the two writes together in one of two ways.

**Transactional Outbox and Polling Publisher** ([ADR-05](#adr-05-go-publishers-use-a-transactional-outbox-with-polling)). Account, Membership and Discussion store each outgoing event in their own database, in the same transaction as the change that raises it. A background publisher polls pending rows, sends them to Kafka in order within each aggregate and marks them as sent only after acknowledgement. A restart resumes the pending work; a failure after publication can cause a duplicate, which the idempotent consumer ignores. The publisher coordination, cleanup and tests are specified in ADR-05. Notification publishes no events and needs no outbox.

Editing keeps direct publication after the operation is stored in its session log and applied to the tree. Its producer retries from memory, so Page Deleted or Block Deleted can still be lost if Editing stops before Kafka acknowledges them, leaving orphan threads in Discussion. This accepted limit does not affect the durability of acknowledged edits in ADR-02. The outboxes protect the other services' events, including Member Removed, but do not guarantee delivery within QA-06's bound during an outage.

**Cascades without a saga.** Workspace Created makes Membership create the membership and Editing the root page; Workspace Deleted makes both delete them, and the Page Deleted that Editing then publishes makes Discussion delete the threads. Each step is a local transaction started by the event of the step before, with no coordinator. No step can be refused by a rule of its context, so none has to undo the steps before it, and the cascade needs neither an orchestrator nor compensations. Kafka's at-least-once delivery and the idempotent consumers make a published event's step happen eventually once the services recover. An event lost before publication by Editing can still stop the cascade. A policy that could be refused would turn its cascade into a saga.
