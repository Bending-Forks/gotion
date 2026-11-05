## Architecture

### Components and Connectors

The view below is the whole system as it is planned for now: it guides the development and will
change with the design. Each bounded context is a service with its own database, the client
reaches them through the API gateway, the events between contexts go through Kafka, and
Prometheus pulls the metrics of every service.

![Components and connectors of Gotion]({{ '/assets/components-and-connectors/gotion.svg' | relative_url }})

That picture mixes three styles and is meant as an overview; it also covers the call-return
style, the synchronous calls. The three views that follow take the other C&C styles one at a
time (event-based, data flow, repository), in the UML notation of Clements et al.: components
with an instance name, ports and connectors, where the colour of each element gives its type in
the style, as the legend of each view says.

Each view is kept as a [draw.io](https://www.drawio.com) file next to its picture in
`assets/components-and-connectors/`, and `render.sh` in the same folder exports every picture
with the draw.io CLI.

**Event-based.** How the services react to each other without knowing who listens. Each
upstream context publishes its events, in its published language, on a Kafka
publish-subscribe connector. The downstream contexts subscribe as conformists (CF) or
through an anticorruption layer (ACL), as in the [context map](#context-map). The
subscriptions to the Membership events are option 1 of PP-04. Apart from Kafka, the page
session channel is how Editing, the one relay of a page
([ADR-01](#adr-01-replicas-merge-concurrent-edits-with-our-own-crdt-editing-relays-the-operations)),
pushes each operation and the presence to the other collaborators, after the durable append
and the ack, within the 300 ms (p95) of QA-02 (US-08).

![Event-based view of Gotion]({{ '/assets/components-and-connectors/event-based.svg' | relative_url }})

**Data flow.** The path of one edit operation, as filters joined by one-way pipes. In the
browser, the editor adapter turns BlockNote changes into operations of our CRDT and applies
them to the local replica first, within the 50 ms of QA-01. Editing checks each operation.
It either sends a refused one back, with the later operations of its author that build on it,
for the author to revert, or appends it to the durable session log. Only then does the
pipeline fork: the ack goes back to the author, which stops the QA-01 timer and starts the
QA-02 one, and the operation is relayed in page order to the other clients. Last, Editing
applies it to the Page Block Tree and publishes the domain events. The view is not a pure
pipe-and-filter: the filters of Editing share the state of the session (the tree for the
check, the collaborators for the relay).

![Data-flow view of one edit operation]({{ '/assets/components-and-connectors/data-flow.svg' | relative_url }})

**Repository.** Here the style is used against sharing: every repository has exactly one
data accessor, the service that owns it, and no service reads or migrates the store of
another (Database-per-Service). This is what keeps a new block type inside Editing with no
shared-schema migration (QA-09), and lets each service migrate its own schema (QA-08). Each
store holds only the aggregates of its context, and Prometheus is the only accessor of the
metrics store, which Grafana reads through Prometheus.

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
- the properties of the pipes (capacity, when full, when empty). -->

### Hexagonal Architecture

<!-- TODO: the internal architecture shared by every service: domain model at the centre,
ports for the repositories and the events, adapters for HTTP, the database and the broker. -->

<!-- TODO SLO: the metrics are collected in the adapters (HTTP, WebSocket), where requests
come in and acknowledgements go out, so the domain model does not depend on Prometheus. -->
