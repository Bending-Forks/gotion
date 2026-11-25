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

- Node.js 24 for everything that runs on Node.js (`.nvmrc`, which the CI reads, and `engines` in `package.json`): the Kafka client of Editing has prebuilt binaries only up to it. `renovate.json` keeps Node.js and `@types/node` on 24 and proposes no npm release whose `engines` leave Node.js 24 out.
- The npm workspaces are the `workspaces` globs of the root `package.json`; npm takes only the folders with a `package.json`.
- Every workspace extends the TypeScript options of `tsconfig.base.json`.
- Editing and the CRDT package: Node.js runs the sources with type stripping, so only erasable syntax (no `enum`, `namespace` or parameter properties) and relative imports ending in `.ts`; `tsc` only checks the types (`npm run build`); tests on `node:test`. Their rules have the details.
- The web client builds with Vite and tests with Vitest.
- Lint of the TypeScript packages: `npm run lint` from the root runs ESLint (`eslint.config.mjs`) on Editing, the CRDT package and the web client, then dependency-cruiser (`.dependency-cruiser.mjs`), whose rules are the fitness functions of ADR-01, ADR-03, ADR-04 and ADR-07 on who may import what. A new rule gets a violation of it in `tests/fixtures/fitness/ts/`, at the path it would have in the repository, or `tests/fitness.test.mjs` fails. The `lint` job also fails when `npm find-dupes` would change `package-lock.json`: after adding or updating a dependency, run `npm dedupe` and commit the lockfile (Renovate does it on its own, `postUpdateOptions` in `renovate.json`).
