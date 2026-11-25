---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.mjs"
  - "**/package.json"
  - "**/tsconfig*.json"
  - ".nvmrc"
---

# Node.js and TypeScript

- Node.js 24 for everything that runs on Node.js (`.nvmrc`, which the CI reads, and `engines` in `package.json`): the Kafka client of Editing has prebuilt binaries only up to it.
- The npm workspaces are the `workspaces` globs of the root `package.json`; npm takes only the folders with a `package.json`.
- Every workspace extends the TypeScript options of `tsconfig.base.json`.
- Editing and the CRDT package: Node.js runs the sources with type stripping, so only erasable syntax (no `enum`, `namespace` or parameter properties) and relative imports ending in `.ts`; `tsc` only checks the types (`npm run build`); tests on `node:test`. Their rules have the details.
- The web client builds with Vite and tests with Vitest.
