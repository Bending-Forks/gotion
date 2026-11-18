# Editing

- From the root of the repository: `npm run build -w services/editing` checks the types with `tsc`, `npm test -w services/editing` runs the tests, `npm start -w services/editing` starts the service.
- Node.js runs the TypeScript sources as they are, stripping the types: only erasable syntax (no `enum`, `namespace` or parameter properties), relative imports end in `.ts`, and type-only imports use `import type`. `tsc` enforces it.
- Tests use `node:test` and `node:assert/strict`, in `*.test.ts` files next to the code they test.
- `src/domain/` imports only `@gotion/crdt`: no `node:` module, no library.
- Fastify and its plugins are the chassis (ADR-07): libraries only in `src/adapters/` and `src/main.ts`.
- Page Deleted and Block Deleted are published straight to Kafka, with no outbox (ADR-05). The append to the session log commits before the ack (ADR-06).
- The roles are a local copy kept from the events of Membership through an anticorruption layer; Membership is asked only when the copy has no row (ADR-03).
