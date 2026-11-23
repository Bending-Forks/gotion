---
title: Implementation
icon: 🛠️
nav_order: 4
---

## Microservices

### Editing client

The client edits a page with [BlockNote](https://www.blocknotejs.org), a block editor built on ProseMirror. It sits behind the adapter of [ADR-01](design.html#adr-01-replicas-merge-concurrent-edits-with-our-own-crdt-editing-relays-the-operations) and could be replaced without touching that record. Only the editor of the client imports it, in `client/web/src/editor/` where the adapter goes, and the collaboration built into BlockNote (Yjs) is not used.

**The interface.** It follows the layout of Notion, cut down to the user stories. The sidebar holds the workspace switcher, the inbox, the settings and members of the workspace and the page tree; a page shows its cover, icon and title, its blocks, the avatars of the collaborators and its comment threads. Search, trash, page history, templates and the other features of Notion that the stories leave out are not there.

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

**Markdown (BR-03).** The text of BlockNote is styled text, not Markdown. The schema allows only the styles Markdown can express, and Editing writes each page as Markdown as well. BlockNote also gives every block a text colour, a background colour and an alignment, which Markdown cannot express: the schema drops them, so a block holds only the fields of its type, as in the CRDT package.

**Accessibility (QA-10).** BlockNote nests blocks with Tab and Shift+Tab and offers
`moveBlocksUp` and `moveBlocksDown`, but claims no WCAG conformance. QA-10 is to be reviewed.

**Tests.**

- Browser tests written with [Playwright](https://playwright.dev) and run in CI open one browser context per client on the same page. They check that the clients converge after concurrent edits, that the cursor, the selection and the focus hold under remote edits, and that undo undoes only local edits.
- A test checks that the editor schema holds only the block types of US-07 and the page block, each with only the fields of its type, and only styles Markdown can express.

### Go services and API gateway

The API gateway and Account, Membership, Discussion and Notification share one Go module, their chassis ([ADR-07](design.html#adr-07-each-runtime-has-its-own-microservice-chassis-assembled-from-libraries)), on Go 1.25 or later. Each library sits in an adapter of [Hexagonal Architecture](design.html#hexagonal-architecture) or in `main`, never in the domain model or in the application services:

| Adapter or concern | Library | Purpose |
|---|---|---|
| REST API, Query API | `net/http`, `oapi-codegen` | A strict server generated from the OpenAPI specification of the service: each handler takes a typed request and returns a typed response |
| Kafka consumer | `watermill`, `watermill-kafka` | The router of the consumers: one handler per event, in the consumer group of the service |
| Outbox table and Polling Publisher | `watermill-sql`, the Forwarder of Watermill, `watermill-kafka` | The events written into the outbox in the transaction of the command, then sent to Kafka keyed by their aggregate ([ADR-05](design.html#adr-05-go-publishers-use-a-transactional-outbox-with-polling)) |
| HTTP client | `net/http`, `oapi-codegen`, `sony/gobreaker/v2` | The queries to other services, with a client generated from the OpenAPI specification of the callee, a timeout and one retry through `context`, and a circuit breaker |
| Sign-in token | `golang-jwt/jwt/v5`, `crypto/ed25519` | Account signs the token after Sign in and sets it in a cookie; the gateway checks it on every request and on the upgrade of a WebSocket, accepting only EdDSA ([ADR-09](design.html#adr-09-the-sign-in-token-is-a-jwt-signed-with-ed25519-in-an-httponly-cookie)) |
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

**The API gateway** uses the chassis without a database, a consumer or an outbox. Before forwarding a request, it checks the sign-in token in its cookie, replaces any `X-User-Id` sent by the client with the `sub` of the token, and refuses the upgrade of a WebSocket from a foreign `Origin` ([ADR-09](design.html#adr-09-the-sign-in-token-is-a-jwt-signed-with-ed25519-in-an-httponly-cookie)). It forwards the REST requests and the WebSocket of each page with `net/http/httputil.ReverseProxy`, which also carries the upgrade of a WebSocket. The WebSocket of page `P` goes to the instance `hash(P) mod N` of Editing ([State and scaling](design.html#state-and-scaling)). The Workspace directory is composed with the client of the queries ([API Composition](design.html#api-composition)).

### Editing service

Editing uses Fastify and its plugins as its chassis ([ADR-07](design.html#adr-07-each-runtime-has-its-own-microservice-chassis-assembled-from-libraries)):

| Adapter or concern | Library | Purpose |
|---|---|---|
| REST API | `fastify` | Set title, icon, cover |
| WebSocket, WebSocket sender | `@fastify/websocket` | One WebSocket per client and open page: the commands of the session in; the answer to Join session with the snapshot, the acks and refusals, the operations of the others and the presence out. The collaborator is the user in the `X-User-Id` header that the gateway sets on the upgrade |
| Kafka consumer | `@confluentinc/kafka-javascript` | The events of Account and Membership; the anticorruption layer turns a role into *read* or *change* |
| Kafka producer | `@confluentinc/kafka-javascript` | Page Deleted and Block Deleted, published directly |
| Roles adapter and its HTTP client | `pg`, the `fetch` of Node.js, `opossum`, `openapi-typescript` | The local copy of the roles, and the query to Membership when it has no row, with types generated from the OpenAPI specification of Membership ([ADR-03](design.html#adr-03-editing-keeps-a-local-copy-of-the-roles-account-and-discussion-ask-membership)) |
| Database, Log store | `pg` | The pages and the copy of the roles; the session log and the snapshots, in the same PostgreSQL server ([ADR-06](design.html#adr-06-each-service-keeps-its-data-in-a-postgresql-server-of-its-own)) |
| Migrations | `node-pg-migrate` | The migrations of Editing, run at start |
| Metrics | `fastify-metrics`, on `@prometheus-io/client`, which replaced `prom-client` | `/metrics`, with the time from an operation to its ack |
| Logs | pino, part of Fastify | JSON on the standard output |
| Types of the events | `json-schema-to-typescript` | The TypeScript types of the events, generated from the JSON Schema of the AsyncAPI specifications ([ADR-08](design.html#adr-08-contracts-are-json-schema-with-no-schema-registry)) |

**Start and readiness.** At start Editing runs the migrations it has not applied yet, connects the producer, and only then listens. node-pg-migrate holds a PostgreSQL advisory lock while it migrates. In its `wait` mode, an instance that starts while another one is migrating waits for the lock and then finds nothing left to run; in the default mode it would fail and be restarted ([ADR-06](design.html#adr-06-each-service-keeps-its-data-in-a-postgresql-server-of-its-own)). `/health/ready` checks the database with `SELECT 1` and Kafka by listing the topics through the admin client of the producer, because the cluster id of the producer comes from its cache and stays known after Kafka stops. The replay of the session logs gets its own check when the session log is written. On SIGTERM, Fastify finishes the requests in flight, then closes the producer and the pool.

**The append to the session log** is an `INSERT` of the operation with the next `seq` of its page, in a transaction that commits before the ack. A unique violation (`23505`) means another instance has extended the log of the page: Editing acknowledges nothing ([ADR-06](design.html#adr-06-each-service-keeps-its-data-in-a-postgresql-server-of-its-own)).

**Direct publication.** Once the operation is applied to the Page Block Tree, the producer publishes the events keyed by the identity of their aggregate, with `acks=all`, and retries from memory until Kafka acknowledges them ([ADR-05](design.html#adr-05-go-publishers-use-a-transactional-outbox-with-polling)).

**The calls to Membership** go through `opossum`, with a timeout and one retry: a call that fails, times out or finds the circuit open denies the command ([ADR-03](design.html#adr-03-editing-keeps-a-local-copy-of-the-roles-account-and-discussion-ask-membership)).

### CRDT package

`packages/crdt` is where the CRDT of [ADR-01](design.html#adr-01-replicas-merge-concurrent-edits-with-our-own-crdt-editing-relays-the-operations) goes, together with the block schema and the protocol that the client and Editing share. It has no runtime dependency. So far it holds the schema and the protocol; the sequence, the tree and the styles come next. ADR-01 leaves open the algorithm of the sequence, how a block is placed among its siblings and how characters, markers and operations are identified. The protocol needs all three now, because its operations carry them and the session log keeps them ([ADR-02](design.html#adr-02-editing-acknowledges-an-operation-once-it-is-in-a-durable-log)), so the choices below settle them.

**The block schema.** `BlockContent` has one member per type of block of US-07 and one for the page block, each with only the fields of its type: the level of a heading, the checkbox of a to-do, the language of a code block, the sub-page of a page block. The text is not there: it is in the sequence of the page. The styles are the five Markdown can express (BR-03): bold, italic, inline code, strikethrough and link.

**The sequence follows Fugue.** RGA, which Automerge uses, converges, but interleaves two passages typed at the same place at once when they are typed backwards, each character before the one typed just before it, and Weidner and Kleppmann find interleaving in most other list CRDTs too. Fugue (Weidner and Kleppmann, "The Art of the Fugue: Minimizing Interleaving in Collaborative Text Editing", arXiv 2023, IEEE TPDS 2025) is designed not to interleave passages typed concurrently at the same place, forwards or backwards, and is about as simple as RGA; its variant FugueMax meets their strongest form of non-interleaving. Two collaborators who write in the same block (US-08) are the case QA-05 stresses, and with Fugue their passages stay readable. An insertion names the element it attaches to and the side, left or right; a run of characters typed in one go is one insertion, each character after the first being the right child of the one before it.

**Siblings are ordered by a position key.** The other way was a list CRDT of the children of each block, a second list CRDT inside the tree with an algorithm of its own to move an element in it. The move operation of Kleppmann et al. carries metadata with each move, where a key fits, so placing or moving a block is one operation that touches that block alone. The key is in the format of David Greenspan's "Implementing Fractional Indexing", and the children of a block, or of the page, are ordered by key, then by the place of their markers in the sequence (US-06). A block divided from another takes the key of the divided block, so the blocks divided from one block, at once or one after the other, follow the order of their text, as ADR-01 asks. A block inserted between two siblings with the same key takes that key too, with its marker right before the marker of the later one, and Enter at the start of a block inserts an empty block before it in the same way, so that block keeps its text, its type and its comment threads (US-07, US-09). The keys have these limits:

- A block cannot be moved between two siblings with the same key: the replica first moves to keys of their own the siblings with that key on one side of the place, one more operation each.
- A division concurrent with a move of the divided block, or with the moves that give its siblings keys of their own, leaves the new block at the old place of the divided one, out of the order of its text.
- Keys grow when blocks are inserted many times at the same place.
- Two concurrent moves of groups of blocks to the same place, or insertions of groups of blocks other than divisions, such as two pastes, can interleave the blocks of the two groups.

**Identities.** Each character, marker and operation needs an identity that is unique in its page, which is what convergence needs (QA-05): two elements with the same identity would be merged into one on some replicas and not on others. A random number chosen by each replica would need 64 bits or more to make a clash unlikely, and would be repeated in every operation, in the log and in the snapshot. Editing, the one relay of the page, gives each replica a number instead when it joins, the next number of the page, and records in its database the user it gave it to, so that a replica that reconnects, even after Editing restarts, gets its number back; joining a session costs a write of the new replica. A character, a marker and an operation are identified by that number and a Lamport counter of the replica, and a block by the identity of its marker, so an identity is two small integers. Every identity an operation refers to has a smaller counter than the operation. Editing refuses an operation whose number is not the one of its connection, or whose counter does not grow past the last one of its replica, unless the operation is already in the log, which Editing acknowledges again if it is the same operation, and closes the connection as malformed otherwise (ADR-02). An insertion of text takes one counter per character, a character being a Unicode code point, so a character outside the Basic Multilingual Plane, such as most emoji, is never split into two UTF-16 halves; an emoji made of several code points, such as a flag, is several characters.

**The operations** are generic, so a new type of block needs none of its own (QA-09): insert a block, with its marker at a place of the sequence as in Fugue and the block at a place of the tree, a parent and a position key in the format of fractional indexing; update it, replacing its content; move it; delete it, keeping its marker; join it to the one before, removing its marker; insert text, a run of characters; delete text, as ranges of identities. Each one carries the version of the protocol, because the session log keeps it ([ADR-02](design.html#adr-02-editing-acknowledges-an-operation-once-it-is-in-a-durable-log)).

Update replaces the content of a block as a last-writer-wins register: of two concurrent updates of the same block every replica keeps the one with the greater identity, and a concurrent update or move of a block that is joined has no effect. QA-05 excludes both cases, as it excludes an edit to a block deleted at the same time. Setting a property is an update of the whole content, which is the same only while each type has at most one property; a type with several needs a generic operation that sets one property, which a later version can add once, for every type, without touching the operations already in the log (QA-09). The text of the page is one sequence, so a concurrent insertion can put characters after the marker of a page block, and a concurrent style can reach the characters of a code block: every replica gives the first to the block of the nearest marker before them in the sequence that is not the marker of a page block, and ignores the second ([Page Block Tree](design.html#page-block-tree)). Once the block between two others is deleted its marker stays between them, so joining the next block to the one before is a join of blocks that are not neighbours in the sequence, which waits for the decision that settles the join ADR-01 leaves open.

**The messages** travel as JSON over the WebSocket of the page:

| From | Message | What it carries |
|---|---|---|
| Client | Join session | The version of the protocol, and for a replica that reconnects its number and the last `seq` it holds; it is the first message on the WebSocket, and only the first |
| Client | Submit edit | One operation, already applied to the replica |
| Client | Leave session | Nothing |
| Editing | Session Joined | The number of the replica and the last `seq` of the page; on a first join the snapshot of the page, for now the operations of the log up to that `seq`, which the state of the sequence and of the tree will replace for the long pages of QA-03. A rejoin that Editing cannot resume is answered as a first join, with a new number, and the operations without an ack are lost |
| Editing | Ack | The identity of the operation and its `seq` in the log. The replica reports at a rejoin the last `seq` it holds, its own operations included; it submits again what has no ack, and Editing recognises what it already stored |
| Editing | Refused | The identities of the refused operation and of the operations of its author that build on it, and why: a broken rule, a role that may not change the content, or Membership not answering |
| Editing | Relayed | An operation of another collaborator, or after a rejoin of the replica itself, with its `seq` |
| Editing | Presence | The users who have the page open, with no cursor |
| Editing | Session Closed | Nothing: the page was deleted |

When the session cannot go on, Editing closes the WebSocket with a code of the range WebSocket leaves to applications, the same in every version of the protocol: 4400 for a malformed message and 4426 for another version of the protocol, after which the client reloads; 4403 when the page does not exist or the user may not read it, or no longer may, after which the client leaves the page; 4409 when a newer connection of the same replica took over, after which the old one does not join again; 4503 when the session cannot go on here for now, after which the client joins again later. A client treats a code of that range it does not know as a malformed message, so the list can grow.

**Encoding.** Each message and operation has a decoder, which reads its JSON and refuses any field its type does not have, any value out of its range, an identity that does not come before the operation, a key out of the format, and a text with a control character other than a tab or a line feed, a line or paragraph separator, or half of a surrogate pair. A version it does not read gets an error of its own, so Editing can tell a client to reload. Each encoder checks the value with the decoder before it writes it, with the fields always in the same order. The tests read back every message after writing it, refuse each message with one field too many or too few at every level, and pin the JSON of every operation and block content as the session log keeps it. The decoders set no limit on the size of a message, so the WebSocket adapter of Editing sets `maxPayload` to the largest message it accepts, well below the 100 MiB that `ws`, under `@fastify/websocket`, accepts by default.

**Tests still to write.** With the sequence and the tree, deterministic tests on the CRDT module will type two passages at the same place at once, forwards and backwards, and check that neither interleaves with the other. They will insert two sibling blocks with the same key at once and check that they follow the order of their markers, and divide "one two three four" before "two" and then the new block before "three" while another replica divides it before "four", so that every replica ends with "one ", "two ", "three " and "four". They will also apply two concurrent updates of the same block in both orders and check that every replica keeps the one with the greater identity. With the session of Editing, a test will check that it refuses an operation with another number than the one of its replica, or with a counter that does not grow, and acknowledges again one already in the log.

## Testing

<!-- TODO SLO: the scenarios whose target is 100 % are invariants, verified by tests and not by an SLO: QA-04 zero loss of acknowledged edits (chaos test: kill the process under load, then check every acknowledged edit after the restart), QA-05 convergence and preservation of acknowledged edits (property-based test over 1 000 randomized interleavings, plus the deterministic tests of ADR-01), QA-06 (authorization matrix per role and operation; for a non-member, "forbidden" and "non-existent" responses compared byte by byte), QA-07 (after 5 failed logins the 6th attempt gets 429). -->

### Contract tests

Every relation of the [Context Map](design.html#context-map) has consumer-driven contract tests, and so do the two queries of the gateway's [API Composition](design.html#api-composition). A contract is a concrete example of one interaction: an event as the consumer reads it, or a request with the response it expects. The consumer writes it, in the `api/contracts/<consumer>/` folder of the provider, next to the OpenAPI or AsyncAPI specification it refers to.

The provider still owns the schema: it is its published language. The example holds only the fields the consumer reads, and must validate against that schema, so a consumer cannot invent a field. When it needs one the provider does not publish, it asks the provider to add it as an optional field, a compatible change ([Contracts](design.html#contracts)), and then adds it to its example. Discussion, for instance, reads only the identity of the deleted page from Page Deleted, besides the envelope it needs to recognize a repeated event:

```text
services/editing/api/
├── asyncapi.yaml
├── events/
│   └── page-deleted.v1.json
└── contracts/
    └── discussion/
        └── page-deleted.json
```

```json
{
  "eventId": "0b9a6c1e-6f0d-4c7a-9a43-2f1d5e8b7c10",
  "type": "PageDeleted",
  "version": 1,
  "data": {
    "pageId": "5d2f8e4a-1c3b-4e6f-8a9d-7b0c2e4f6a81"
  }
}
```

Each example is used twice:

- **In the tests of the provider**, as the expected output. For an event, the producer builds it in the scenario of the example; the result must validate against its schema and contain the example, while any other field is ignored. For a query, the test replays the request on the handler in memory (`httptest` in Go, `fastify.inject` in Editing), with the application services stubbed, and the response must contain the one of the example.
- **In the tests of the consumer**, as the input. An event goes into the real Kafka adapter of the consumer. A conformist checks that its application service receives the identities of the example; a consumer with an anticorruption layer checks the translated value instead, so Editing checks that a role of Membership becomes "may read" or "may also change", and Notification that Member Invited becomes an invitation `Subject`. For a query, the example serves as a stub of the provider for the HTTP client adapter.

Removing or renaming a field that no consumer reads passes; removing or renaming one that a consumer reads fails in the pull request of the provider, and the path of the example names the consumer to agree the change with. Since the provider and the consumer may be written in different languages, this is the check that [ADR-04](design.html#adr-04-editing-runs-on-nodejs-with-the-crdt-of-the-client-the-other-services-on-go) requires.

The tests need a JSON Schema validator in each runtime, `santhosh-tekuri/jsonschema` in Go and `ajv` in Editing, and a match of an example inside a message of a few lines. Pact would run the same checks, with its own DSL in both languages and a native library to install in the CI of Go; its broker pays off when the provider and its consumers are released from separate repositories, which [ADR-08](design.html#adr-08-contracts-are-json-schema-with-no-schema-registry) excludes. Validating each message against the schema alone would not say which fields a consumer reads.

## Multiplatform

Gotion runs on two runtimes ([ADR-04](design.html#adr-04-editing-runs-on-nodejs-with-the-crdt-of-the-client-the-other-services-on-go)). Account, Membership, Discussion, Notification and the API gateway are written in Go, and every Go module needs Go 1.25 or later. Editing is written in TypeScript on Node.js, and the web client in TypeScript with React. Editing and the client import the same CRDT package.

Editing and the CRDT package run their TypeScript sources as they are: Node.js strips the types when it loads a file, so there is no build step and no compiled copy to keep in step with the sources. The CRDT package exports its sources, which Node.js reads in Editing and Vite in the web client. The price is that only TypeScript syntax that can be erased is allowed: no `enum`, no `namespace`, no parameter properties, and relative imports end in `.ts`. `tsc` checks the types without emitting anything and refuses that syntax, with the strict options every package takes from `tsconfig.base.json`. The build checks the library code of the CRDT package with neither the DOM nor the types of Node.js (`tsconfig.lib.json`), so it refuses any use of the browser or of Node.js in it; `tsconfig.json`, which adds the Node types for the tests, is the one an editor opens. The tests of both run on `node:test`, the test runner built into Node.js.

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
