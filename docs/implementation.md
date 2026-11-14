---
title: Implementation
icon: 🛠️
nav_order: 4
---

## Microservices

### Editing client

The client edits a page with [BlockNote](https://www.blocknotejs.org), a block editor built on
ProseMirror. It sits behind the adapter of [ADR-01](design.html#adr-01-replicas-merge-concurrent-edits-with-our-own-crdt-editing-relays-the-operations)
and could be replaced without touching that record. Only the adapter imports it, and the
collaboration built into BlockNote (Yjs) is not used.

**Why BlockNote.** Its blocks already match the ones of US-07: `paragraph`, `heading` with
levels 1 to 6, `bulletListItem`, `numberedListItem`, `checkListItem` and `codeBlock` with its
language. It nests blocks, and its custom blocks cover the page block and any new block type
(QA-09). The core is under MPL-2.0 and its `xl-*` packages under GPL-3.0, both compatible with
the GPL-3.0 of Gotion (BR-06).

**The adapter.**

- It turns the changes of the editor into operations of the CRDT, and applies the remote
  operations as minimal ProseMirror steps through `editor.transact`, outside the undo history.
- BlockNote reports a changed block, not the typed characters. The adapter compares the text of
  the block before and after the change and uses the cursor to tell repeated characters apart.
  Paste and input methods (IME) are still to be tested.
- To turn an offset in a block into a ProseMirror position, the adapter relies on the shape of
  the BlockNote schema, which is not documented. It keeps this in one function, and the client
  pins the BlockNote version.
- Undoing a local deletion inserts new characters instead of restoring the deleted ones, so an
  edit made meanwhile at that place by someone else may end up on the other side.
- Long pages need an index over the characters and batched operations.

**Markdown (BR-03).** The text of BlockNote is styled text, not Markdown. The schema allows only
the styles Markdown can express, and Editing writes each page as Markdown as well.

**Accessibility (QA-10).** BlockNote nests blocks with Tab and Shift+Tab and offers
`moveBlocksUp` and `moveBlocksDown`, but claims no WCAG conformance. QA-10 is to be reviewed.

**Tests.**

- Browser tests with several clients, run in CI, check that the cursor, the selection and the
  focus hold under remote edits, and that undo undoes only local edits.
- A test checks that the editor schema holds only the block types of US-07 and the page block,
  and only styles Markdown can express.

### Go services and API gateway

The API gateway and Account, Membership, Discussion and Notification share one Go module, their chassis ([ADR-07](design.html#adr-07-each-runtime-has-its-own-microservice-chassis-assembled-from-libraries)), on Go 1.25 or later. Each library sits in an adapter of [Hexagonal Architecture](design.html#hexagonal-architecture) or in `main`, never in the domain model or in the application services:

| Adapter or concern | Library | Purpose |
|---|---|---|
| REST API, Query API | `net/http`, `oapi-codegen` | A strict server generated from the OpenAPI specification of the service: each handler takes a typed request and returns a typed response |
| Kafka consumer | `watermill`, `watermill-kafka` | The router of the consumers: one handler per event, in the consumer group of the service |
| Outbox table and Polling Publisher | `watermill-sql`, the Forwarder of Watermill, `watermill-kafka` | The events written into the outbox in the transaction of the command, then sent to Kafka keyed by their aggregate ([ADR-05](design.html#adr-05-go-publishers-use-a-transactional-outbox-with-polling)) |
| HTTP client | `net/http`, `oapi-codegen`, `sony/gobreaker/v2` | The queries to other services, with a client generated from the OpenAPI specification of the callee, a timeout and one retry through `context`, and a circuit breaker |
| Database | `jackc/pgx/v5`, `sqlc` | The pool of connections, and typed queries generated from SQL |
| Migrations | `pressly/goose` | The migrations of the service, embedded in the binary with `embed`, run at start ([ADR-06](design.html#adr-06-each-service-keeps-its-data-in-a-postgresql-server-of-its-own)) |
| Metrics | `prometheus/client_golang` | `/metrics`, served with `promhttp` |
| Types of the events | `go-jsonschema` | The Go types of the events, generated from the JSON Schema of the AsyncAPI specifications ([ADR-08](design.html#adr-08-contracts-are-json-schema-with-no-schema-registry)) |
| Logs, health checks, configuration | Standard library | `log/slog` writes JSON to the standard output; two handlers answer the health checks; `os.Getenv` reads the configuration |

**The chassis module** gives every Go service:

- an HTTP server that stops cleanly, finishing the requests in flight before it exits;
- `/health/live` and `/health/ready`, with the checks of [Observability](design.html#observability), and `/metrics`;
- the configuration, read from environment variables;
- the logs, as JSON on the standard output;
- the pool of pgx connections, with the goose migrations run at start;
- the Kafka publisher, which keys each event by its aggregate;
- the router of the consumers, which records the identifier of each applied event in the same transaction as its change and skips a repeated one ([Contracts](design.html#contracts));
- the outbox, with the Forwarder, the task that deletes the old rows and the metrics of the pending rows and of the age of the oldest one;
- the client of the queries, with a timeout, one retry and a circuit breaker, which refuses the command whenever the call fails ([Dependencies at run time](design.html#dependencies-at-run-time)).

**What each service generates.** Its server from its OpenAPI specification, the access to its data from its SQL, and the types of its events from their JSON Schema. The generated code is committed, and the CI checks that it matches its source ([ADR-08](design.html#adr-08-contracts-are-json-schema-with-no-schema-registry)).

**The API gateway** uses the chassis without a database, a consumer or an outbox. It forwards the REST requests and the WebSocket of each page with `net/http/httputil.ReverseProxy`, which also carries the upgrade of a WebSocket. The WebSocket of page `P` goes to the instance `hash(P) mod N` of Editing ([State and scaling](design.html#state-and-scaling)). The Workspace directory is composed with the client of the queries ([API Composition](design.html#api-composition)).

### Editing service

Editing uses Fastify and its plugins as its chassis ([ADR-07](design.html#adr-07-each-runtime-has-its-own-microservice-chassis-assembled-from-libraries)):

| Adapter or concern | Library | Purpose |
|---|---|---|
| REST API | `fastify` | Set title, icon, cover |
| WebSocket, WebSocket sender | `@fastify/websocket` | One WebSocket per client and open page: the commands of the session in, the acks, the operations of the others and the presence out |
| Kafka consumer | `@confluentinc/kafka-javascript` | The events of Account and Membership; the anticorruption layer turns a role into *read* or *change* |
| Kafka producer | `@confluentinc/kafka-javascript` | Page Deleted and Block Deleted, published directly |
| Roles adapter and its HTTP client | `pg`, the `fetch` of Node.js, `opossum`, `openapi-typescript` | The local copy of the roles, and the query to Membership when it has no row, with types generated from the OpenAPI specification of Membership ([ADR-03](design.html#adr-03-editing-keeps-a-local-copy-of-the-roles-account-and-discussion-ask-membership)) |
| Database, Log store | `pg` | The pages and the copy of the roles; the session log and the snapshots, in the same PostgreSQL server ([ADR-06](design.html#adr-06-each-service-keeps-its-data-in-a-postgresql-server-of-its-own)) |
| Migrations | `node-pg-migrate` | The migrations of Editing, run at start |
| Metrics | `fastify-metrics`, on `prom-client` | `/metrics`, with the time from an operation to its ack |
| Logs | pino, part of Fastify | JSON on the standard output |
| Types of the events | `json-schema-to-typescript` | The TypeScript types of the events, generated from the JSON Schema of the AsyncAPI specifications ([ADR-08](design.html#adr-08-contracts-are-json-schema-with-no-schema-registry)) |

**The append to the session log** is an `INSERT` of the operation with the next `seq` of its page, in a transaction that commits before the ack. A unique violation (`23505`) means another instance has extended the log of the page: Editing acknowledges nothing ([ADR-06](design.html#adr-06-each-service-keeps-its-data-in-a-postgresql-server-of-its-own)).

**Direct publication.** Once the operation is applied to the Page Block Tree, the producer publishes the events keyed by the identity of their aggregate, with `acks=all`, and retries from memory until Kafka acknowledges them ([ADR-05](design.html#adr-05-go-publishers-use-a-transactional-outbox-with-polling)).

**The calls to Membership** go through `opossum`, with a timeout and one retry: a call that fails, times out or finds the circuit open denies the command ([ADR-03](design.html#adr-03-editing-keeps-a-local-copy-of-the-roles-account-and-discussion-ask-membership)).

## Testing

<!-- TODO SLO: the scenarios whose target is 100 % are invariants, verified by tests and not
by an SLO: QA-04 zero loss of acknowledged edits (chaos test: kill the process under load,
then check every acknowledged edit after the restart), QA-05 convergence (property-based
test over 1 000 randomized interleavings), QA-06 (authorization matrix per role and
operation; for a non-member, "forbidden" and "non-existent" responses compared byte by byte),
QA-07 (after 5 failed logins the 6th attempt gets 429). -->

## Multiplatform

Gotion runs on two runtimes ([ADR-04](design.html#adr-04-editing-runs-on-nodejs-with-the-crdt-of-the-client-the-other-services-on-go)). Account, Membership, Discussion, Notification and the API gateway are written in Go, and every Go module needs Go 1.25 or later. Editing is written in TypeScript on Node.js, and the web client in TypeScript with React. Editing and the client import the same CRDT package.

## Experiments

## Monitoring

<!-- TODO SLO: the SLOs are the response measures of the runtime scenarios, measured over 30
days: QA-01, QA-02, QA-03 and the recovery within 60 s of QA-04. For each one: the SLI as good
events over valid events, the target, the error budget, the metric and its PromQL query, the
Grafana dashboard and the alert (steps 4 and 5 of the lab notes "Quality Attributes in SRE").
The local render of QA-01 and the remote render of QA-02 are measured in the client, and
QA-02 corrects for the offset between the client and server clocks. Say also why the other
scenarios have no SLO: they are invariants (see Testing) or development time attributes (see
CI/CD in DevOps). -->
