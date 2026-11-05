## Architecture

### Components and Connectors

The view below is the whole system as it is planned for now: it guides the development and will
change with the design. Each bounded context is a service with its own database, the client
reaches them through the API gateway, the events between contexts go through Kafka, and
Prometheus pulls the metrics of every service.

![Components and connectors of Gotion]({{ '/assets/components-and-connectors/gotion.svg' | relative_url }})

| Element | Type | Responsibility | Properties |
|---|---|---|---|
| Web client | Client | Edits the pages with BlockNote, through the editor adapter and a CRDT replica of each open page | Talks only to the API gateway: REST for the requests, one WebSocket for each open page |
| API Gateway | Infrastructure | The one entry point from outside: authenticates each request and routes it to its service | Forwards the WebSocket of a page to Editing; technology still open |
| Account | Service | Users and workspaces (`User`, `Workspace`) | Answers one synchronous query, the user registered with an email address; publishes Workspace Created and Workspace Deleted |
| Membership | Service | Members, roles and invitations (`Workspace Membership`) | Asks Account for the user of an email address before an invitation; publishes the changes of membership and roles, and Member Invited |
| Editing | Service | Pages and their content (`Page`, `Page Block Tree`, `Real-time Editing Session`); the one relay of the operations of a page | Event-sourced ([ADR-02](#adr-02-editing-acknowledges-an-operation-once-it-is-in-a-durable-log)); publishes Page Deleted and Block Deleted |
| Discussion | Service | Comment threads on pages and blocks (`Comment Thread`) | Publishes Comment Posted |
| Notification | Service | The in-app notifications of invitations and mentions (`Notification`) | Only subscribes, publishes nothing |
| Service databases | Repository | One for each service, with the data of its context only | Read and written only by the service that owns it (Database-per-Service) |
| Prometheus | Monitoring | Pulls the metrics of every service from `/metrics` and keeps them as time series | The only accessor of the metrics store |
| Grafana | Monitoring | The SLO dashboards and the alerts | Reads the metrics only through Prometheus, with PromQL |
| REST | Call-return connector | A synchronous request and its response: from the client through the gateway, and from Membership to Account | The caller waits for the response |
| WebSocket | Event channel connector | The session of a page: operations, acks and presence, both ways | One per client and open page, through the gateway |
| Apache Kafka | Publish-subscribe connector | Carries the events of each upstream context to the contexts that subscribe | One channel for each upstream context, in its published language. Kafka keeps the order only within a partition, so each event is keyed by the identity of its aggregate; it can deliver an event twice, so every subscriber must handle a repeated event with no effect |
| DB access | Data-access connector | A service reading and writing its own database | Never across services |
| Scrape | Pull connector | Prometheus reading `/metrics` | Started by Prometheus, not by the service |

That picture mixes styles and is meant as an overview. The three views that follow take one
C&C style at a time (event-based, data flow, repository), in the UML notation of Clements et al.: components
with an instance name, ports and connectors, where the colour of each element gives its type in
the style, as the legend of each view says.

Each view is kept as a [draw.io](https://www.drawio.com) file next to its picture in
`assets/components-and-connectors/`, and `render.sh` in the same folder exports every picture
with the draw.io CLI.

**Event-based.** How the services react to each other without knowing who listens. Each
upstream context publishes its events, in its published language, on a Kafka
publish-subscribe connector. The downstream contexts subscribe as conformists (CF) or
through an anticorruption layer (ACL), as in the [context map](#context-map). The
subscriptions of Editing, Account and Discussion to the Membership events, dotted grey in the
picture, are provisional: they are the first option of PP-04, which is still open, and they go
away if those contexts ask Membership on every command instead. Apart from Kafka, the page
session channel is how Editing, the one relay of a page
([ADR-01](#adr-01-replicas-merge-concurrent-edits-with-our-own-crdt-editing-relays-the-operations)),
pushes each operation and the presence to the other collaborators, after the durable append
and the ack, within the 300 ms (p95) of QA-02 (US-08).

![Event-based view of Gotion]({{ '/assets/components-and-connectors/event-based.svg' | relative_url }})

**Data flow.** The path of one edit operation, as filters joined by one-way pipes. In the
browser, the editor adapter turns BlockNote changes into operations of our CRDT and applies
them to the local replica first. Editing checks each operation.
It either sends a refused one back, with the later operations of its author that build on it,
for the author to revert, or appends it to the durable session log. Only then does the
pipeline fork: the ack goes back to the author, which stops the QA-01 timer and starts the
QA-02 one, and the operation is relayed in page order to the other clients. Last, Editing
applies it to the Page Block Tree, saves a snapshot of the tree from time to time, and
publishes the domain events. The session log and the snapshots are in the one store of Editing. The view is not a pure
pipe-and-filter: the filters of Editing share the state of the session (the tree for the
check, the collaborators for the relay).

![Data-flow view of one edit operation]({{ '/assets/components-and-connectors/data-flow.svg' | relative_url }})

**Repository.** Every store has exactly one data accessor, the service that owns it: no
service reads or migrates the store of another (Database-per-Service). A new block type
therefore never touches the store of another service, and inside Editing it leaves the schema
alone as long as the operations stay generic
([ADR-01](#adr-01-replicas-merge-concurrent-edits-with-our-own-crdt-editing-relays-the-operations)):
together, the two give the "no change to the persistence schema" of QA-09. Each service also
migrates only its own schema, so the automatic migrations of QA-08 need no step coordinated
across services. The stores of Account, Membership, Discussion and Notification hold the
current state of their aggregates. The store of Editing is event-sourced
([ADR-02](#adr-02-editing-acknowledges-an-operation-once-it-is-in-a-durable-log)): next to
Page, it keeps the session log, the operations of every page in the order Editing accepted
them, and snapshots of the Page Block Tree; the tree is rebuilt from the last snapshot by
replaying the operations that follow it. Prometheus is the only accessor of the metrics store,
which Grafana reads through Prometheus.

![Repository view of Gotion]({{ '/assets/components-and-connectors/repository.svg' | relative_url }})

<!-- TODO: settle in the views what is still open while drawing them:
- how Editing serves the page open (QA-03), the snapshot for a late joiner, the root page and
  the list of sub-pages: over the WebSocket or with a REST interface of its own;
- the state the check of Editing runs on: the tree lags behind the log (ADR-02), so it needs
  a replica that already holds every accepted operation;
- whether the ack instant of QA-01 and QA-02 is when Editing sends it or when the author gets it;
- whether presence skips the session log;
- which Editing events go to Kafka besides Page Deleted and Block Deleted; Block Updated is in
  the tactical design but missing from ADR-01;
- where the read models live (page block metadata, workspace directory);
- the properties of the pipes (capacity, when full, when empty);
- the runtime of each service, Editing above all: the CRDT runs on both sides (ADR-01), so
  Editing either shares the runtime of the client or has a second implementation of the module
  that passes the same tests; the overview shows Go and Node.js/TypeScript only as planned;
- with several instances of the gateway and of Editing, how the WebSocket of a page reaches
  the one instance that relays it, and how the page moves to another instance when that one
  fails (ADR-01, QA-04). -->

### Hexagonal Architecture

<!-- TODO: the internal architecture shared by every service: domain model at the centre,
ports for the repositories and the events, adapters for HTTP, the database and the broker. -->

<!-- TODO SLO: the metrics are collected in the adapters (HTTP, WebSocket), where requests
come in and acknowledgements go out, so the domain model does not depend on Prometheus. -->
