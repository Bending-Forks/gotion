// Generates the TypeScript types of the events Editing publishes from the JSON Schema of their bodies in api/events/, into src/adapters/events/: they are committed and never edited by hand (ADR-08).
import { readdirSync, writeFileSync } from 'node:fs'
import { compileFromFile } from 'json-schema-to-typescript'

const events = new URL('./api/events/', import.meta.url)
for (const file of readdirSync(events).filter((f) => f.endsWith('.json'))) {
  const out = `src/adapters/events/${file.replace(/\.json$/, '.ts')}`
  writeFileSync(new URL(out, import.meta.url), await compileFromFile(new URL(file, events).pathname, { cwd: events.pathname, additionalProperties: false }))
  console.log(out)
}
