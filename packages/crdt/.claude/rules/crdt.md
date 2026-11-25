# CRDT

- From the root of the repository: `npm run build -w packages/crdt` checks the types with `tsc`, `npm test -w packages/crdt` runs the tests (`node:test`, `*.test.ts` next to the code).
- The CRDT of ADR-01 with the block schema and the protocol of the operations, shared by the client and Editing (ADR-04).
- No browser, no Node.js, no editor: the build checks the library with `tsconfig.lib.json`, which has neither DOM nor Node types, so `tsc` refuses them; `tsconfig.json`, the one an editor opens, adds the Node types, for the tests, so only the build catches Node.js in library code. No runtime dependencies.
- It is exported as TypeScript source (`"exports": "./src/index.ts"`), read as it is by Node.js in Editing and by Vite in the client: only erasable syntax, relative imports end in `.ts`, type-only imports use `import type`. Write the escapes of U+2028 and U+2029 as `\u2028` and `\u2029`, never the characters themselves, which end a line of JavaScript.
- Every operation carries the version of the protocol, because the session log is read again after the protocol changes (ADR-02). The JSON of the stored operations and block contents is pinned in `codec.test.ts`: changing it means a new version and a way to read the older one.
- `schema.ts` has the block schema, `protocol.ts` the operations, the messages and the close codes of the WebSocket, `codec.ts` their encoders and decoders. The decoders refuse any field a type does not have, and the encoders check a value with them before they write it. A new type of block is a member of `BlockContent` and a case of `decodeBlockContent`, never a new operation (QA-09).
- The sequence follows Fugue, the tree the move of Kleppmann et al. with a position key among siblings, and Editing numbers each replica at join (ADR-01; the choices are in Implementation, CRDT package).

## State

The block schema, the identities and the protocol are implemented, with their JSON encoders and strict decoders. The CRDT itself, the sequence and the tree, not yet.
