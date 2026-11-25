---
paths:
  - "services/{account,membership,discussion,notification,editing}/**"
---

# Hexagonal Architecture in the services

Each of these services is one bounded context. Its hexagon is in `internal/` (`src/` in Editing):

- `domain/` holds the aggregates, value objects and rules of the bounded context. In Go it imports only the standard library; in Editing only `@gotion/crdt`, the model of the document, and no `node:` module. No chassis, no generated code, no I/O.
- `app/` holds one application service per command, query or policy. It declares the ports it needs as interfaces (a repository, the outbox, the query to another service) and imports only `domain/`; in Editing only the domain sees `@gotion/crdt`, and re-exports what `app/` needs of it.
- `adapters/` implements the ports and calls the application services: the REST server, the Kafka consumers, the repositories on PostgreSQL, the clients of other services. Libraries and the chassis are imported only here and in `main.go` (`src/main.ts`).
- `main.go` (`src/main.ts`) reads the configuration, builds the adapters and connects them to the ports, with no logic of its own.
- Code generated from `api/` or from SQL lives in the adapter that uses it, is committed, and is never edited by hand: change its source and generate it again.
- A consumer generates the types of an event from the `api/` of its producer; there is no package of shared types. A service never imports the code of another service.
- `api/` holds the OpenAPI and AsyncAPI specifications the service owns, and `api/contracts/<consumer>/` the examples each consumer writes of what it reads.
- `migrations/` holds the SQL migrations of the service's database, run at start. A migration already on `main` is never changed: add a new one.
