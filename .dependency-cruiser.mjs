// The fitness functions of the TypeScript packages, the rules of the ADRs on who may import what: `npm run lint` runs them, and tests/fitness.test.mjs checks that each one fails on a violation.
import { readdirSync } from 'node:fs'

// The modules generated from the events of Membership are named after their schemas, wherever they are
const membershipEvents = readdirSync(new URL('services/membership/api/events/', import.meta.url))
  .map((file) => file.replace(/\.json$/, '').replaceAll('.', '\\.'))
  .join('|')

export default {
  forbidden: [
    {
      name: 'editor-only-in-client-adapter',
      comment: 'ADR-01: only the adapter of the client, in client/web/src/editor/, imports BlockNote, Tiptap or ProseMirror; never the CRDT, Editing or the rest of the client',
      severity: 'error',
      from: { pathNot: '^client/web/src/editor/' },
      to: { path: '(^|node_modules/)(@blocknote|@tiptap|prosemirror-[^/]+)/' },
    },
    {
      name: 'crdt-only-from-package',
      comment: 'ADR-04: the client and Editing import the CRDT only from the shared package, as @gotion/crdt, never through a relative path into it',
      severity: 'error',
      from: { path: '^(client/web|services/editing)/' },
      to: { path: '^packages/crdt/', dependencyTypes: ['local'] },
    },
    {
      name: 'no-other-crdt',
      comment: 'ADR-04 and ADR-01: the client, Editing and the CRDT package merge edits only with our CRDT: no Yjs, no Automerge, no collaboration of BlockNote',
      severity: 'error',
      from: { path: '^(client/web|services/editing|packages/crdt)/' },
      to: { path: '(^|node_modules/)(yjs|y-[^/]+|@y/[^/]+|automerge|@automerge/[^/]+|loro-crdt)(/|$)|node_modules/@blocknote/core/(dist/y(js)?\\.js|types/src/y(js)?/)' },
    },
    {
      name: 'crdt-imports-only-itself',
      comment: 'ADR-01 and the hexagon: the CRDT, the model of the document that the domain of Editing imports, imports only itself: no library and no node: module, so the domain of Editing stays free of them too',
      severity: 'error',
      from: { path: '^packages/crdt/src/', pathNot: '\\.test\\.ts$' },
      to: { pathNot: '^packages/crdt/src/' },
    },
    {
      name: 'editing-domain-imports-only-crdt',
      comment: 'ADR-07 and the hexagon: the domain of Editing imports only itself and @gotion/crdt, the model of the document: no library (ADR-07), no node: module, no other layer',
      severity: 'error',
      from: { path: '^services/editing/src/domain/', pathNot: '\\.test\\.ts$' },
      to: { pathNot: '^(services/editing/src/domain|packages/crdt/src)/' },
    },
    {
      name: 'editing-app-imports-only-domain',
      comment: 'ADR-07 and the hexagon: the application services of Editing import only themselves and the domain, which alone sees the CRDT: no library (ADR-07), no node: module, no adapter',
      severity: 'error',
      from: { path: '^services/editing/src/app/', pathNot: '\\.test\\.ts$' },
      to: { pathNot: '^services/editing/src/(app|domain)/' },
    },
    {
      name: 'membership-events-only-in-their-consumer',
      comment: 'ADR-03: in Editing only the Kafka consumer of the events of Membership, services/editing/src/adapters/membership-events/, names them: its anticorruption layer turns them into the calls to the application services that keep the copy of the roles and make a removed member leave the sessions',
      severity: 'error',
      from: { path: '^services/editing/src/', pathNot: '^services/editing/src/adapters/membership-events/' },
      to: { path: `/(${membershipEvents})\\.ts$` },
    },
  ],
  options: {
    // Type-only imports are dependencies too, though Node.js erases them
    tsPreCompilationDeps: true,
    doNotFollow: { path: 'node_modules' },
    // The bundle Vite builds locally
    exclude: { path: '^client/web/dist/' },
    // The packages that export only an import condition, such as vite and react-router, resolve too
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require', 'node', 'default', 'types'] },
  },
}
