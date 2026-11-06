## Patterns

The microservice patterns Gotion applies, gathered in one place. Most of them are described where
the decision that needs them is taken; the table names the problem each one solves and links to
that description. Observability has no other place in the design, so it is described below.

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
| Choreography of the policies across contexts | The cascades that follow Workspace Created, Workspace Deleted, Page Deleted | Each context reacts to the events of the others with no coordinator, and no step can be refused, so none needs a compensation | [Event delivery](#event-delivery), [ADR-05](#adr-05-services-publish-their-events-after-the-commit) |
| Single writer per page, routed by a fixed hash | Editing, StatefulSet | Every operation of a page goes through one relay (ADR-01), with no table of assignments to keep | [State and scaling](#state-and-scaling) |
| Health Check API | Every service | Kubernetes restarts an instance that is stuck and sends traffic only to one that is ready (QA-04) | [Observability](#observability) |
| Application Metrics | Every service and the client | The runtime scenarios are measured while the system runs (QA-01 to QA-04) | [Observability](#observability) |

### Event delivery

A command changes the state in the store of its service, and the event that tells the other
contexts goes out on Kafka. The two are separate systems with no transaction across them, so
the order of the two writes decides what a failure between them does.

**Publication after the commit**
([ADR-05](#adr-05-services-publish-their-events-after-the-commit)). Every service publishes an
event only once the change of state that raises it is stored: Account, Membership and
Discussion after the commit of their transaction, Editing after the operation is in the session
log and applied to the Page Block Tree. An event is therefore never published for a change that
was not stored. The Kafka producer of the service retries until Kafka acknowledges the event,
so while the service runs, Kafka being down or a network fault only delays the event: it waits
in memory and goes out when Kafka is back.

The event is lost if the service stops after the commit and before Kafka acknowledges it: in a
crash, a few milliseconds after the commit, or at any time while Kafka is down and the events
wait in memory. Nothing raises it again, so the policy downstream never runs for it. With
Member Removed lost, Editing keeps letting the removed member edit, against QA-06; with Block
Deleted lost, the comment threads of the block stay in Discussion. Gotion accepts this limit
in the prototype: a [Transactional Outbox](#adr-05-services-publish-their-events-after-the-commit)
would close it, and can be added later without changing the consumers or the contracts.

**Cascades without a saga.** Some commands set off a chain of policies in other contexts:
Workspace Created makes Membership create the membership of the workspace and Editing its root
page; Workspace Deleted makes both delete them, and Editing then publishes Page Deleted, which
makes Discussion delete the threads. Each step is a local transaction of one service, started
by the event of the step before, with no coordinator: a choreography. None of these steps can
be refused by a rule of its context: creating the membership or the root page of a new
workspace always succeeds, and deleting what is not there changes nothing. So no step ever has
to undo the steps before it, and the cascade needs neither an orchestrator nor compensating
transactions. Once an event is published, the at-least-once delivery of Kafka and the
idempotent consumers make its step happen sooner or later, and until then the system is only
eventually consistent: a deleted page keeps its comment threads for a while, within the bounds
of the scenarios. A step whose event is lost as above never runs, and the cascade stops there.
If a policy could one day be refused by a rule of its context, that cascade would become a saga
with its compensations.
