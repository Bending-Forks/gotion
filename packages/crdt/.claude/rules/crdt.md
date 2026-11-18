# CRDT

- From the root of the repository: `npm run build -w packages/crdt` checks the types with `tsc`, `npm test -w packages/crdt` runs the tests (`node:test`, `*.test.ts` next to the code).
- The CRDT of ADR-01 with the block schema and the protocol of the operations, shared by the client and Editing (ADR-04).
- No browser, no Node.js, no editor: `tsconfig.json` has neither DOM nor Node types, so `tsc` refuses them. No runtime dependencies.
- It is exported as TypeScript source (`"exports": "./src/index.ts"`), read as it is by Node.js in Editing and by Vite in the client: only erasable syntax, relative imports end in `.ts`, type-only imports use `import type`.
- Every operation carries the version of the protocol, because the session log is read again after the protocol changes (ADR-02).
