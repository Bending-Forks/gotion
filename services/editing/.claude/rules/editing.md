# Editing

- From the root of the repository: `npm run build -w services/editing` checks the types with `tsc`, `npm test -w services/editing` runs the tests, `npm start -w services/editing` starts the service. The tests of the PostgreSQL adapter need `TEST_DATABASE_URL`, a server where they may create and drop databases, and are skipped without it.
- `@confluentinc/kafka-javascript` is a native binding, with prebuilt binaries up to Node.js 24, the version of the project (`.nvmrc`, `engines`); on a later Node.js npm compiles it, which needs a C and C++ toolchain and can fail. Use Node.js 24.
- Node.js runs the TypeScript sources as they are, stripping the types: only erasable syntax (no `enum`, `namespace` or parameter properties), relative imports end in `.ts`, and type-only imports use `import type`. `tsc` enforces it.
- Tests use `node:test` and `node:assert/strict`, in `*.test.ts` files next to the code they test.
- `src/domain/` imports only `@gotion/crdt`: no `node:` module, no library.
- The chassis is Fastify with its plugins and the libraries ADR-07 chose, not a framework and not written from scratch: `fastify` for REST, `@fastify/websocket`, `@confluentinc/kafka-javascript` for the producer and the consumers, `pg`, `node-pg-migrate`, `fastify-metrics` on `@prometheus-io/client` (the successor of `prom-client`), `opossum` for the circuit breaker, pino (part of Fastify) for the logs; the types from `json-schema-to-typescript` and `openapi-typescript`. They are imported only in `src/adapters/` and `src/main.ts`.
- `npm run gen:events -w services/editing` writes the types of the events of `api/events/` into `src/adapters/events/`; run it after changing a schema there, and never edit those files by hand.
- Page Deleted and Block Deleted are published straight to Kafka, with no outbox (ADR-05). The append to the session log commits before the ack (ADR-06).
- The roles are a local copy kept from the events of Membership through an anticorruption layer; Membership is asked only when the copy has no row (ADR-03).
