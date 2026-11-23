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
      name: 'editing-domain-imports-only-crdt',
      comment: 'ADR-07: the domain of Editing imports only itself and @gotion/crdt, the model of the document: no node: module, no library, no other layer',
      severity: 'error',
      from: { path: '^services/editing/src/domain/', pathNot: '\\.test\\.ts$' },
      to: { pathNot: '^(services/editing/src/domain|packages/crdt/src)/' },
    },
    {
      name: 'editing-app-imports-only-domain',
      comment: 'ADR-07: the application services of Editing import only themselves, the domain and @gotion/crdt: no node: module, no library, no adapter',
      severity: 'error',
      from: { path: '^services/editing/src/app/', pathNot: '\\.test\\.ts$' },
      to: { pathNot: '^(services/editing/src/(app|domain)|packages/crdt/src)/' },
    },
    {
      name: 'membership-events-only-in-roles-adapter',
      comment: 'ADR-03: only the adapter of AccessLookupService in Editing, services/editing/src/adapters/roles/, consumes the events of Membership: the handler of the Kafka consumer for them lives there, and its anticorruption layer feeds the table of the roles and makes a removed member leave the sessions',
      severity: 'error',
      from: { path: '^services/editing/src/', pathNot: '^services/editing/src/adapters/roles/' },
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
