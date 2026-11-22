// Fails if the built client would load anything from another domain: Gotion calls no external service at run time (BR-01).
// HTML and CSS must not name an absolute URL at all; in JavaScript, URLs inside strings (such as the links of React's error messages) are allowed, a fetch, WebSocket or import of one is not.
// A URL built at run time escapes this check: the client refuses to call anything outside the API of the gateway (src/api/client.ts).
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// The bundle to check: dist/, or the folder given, as the tests do
const dist = process.argv[2] ?? fileURLToPath(new URL('./dist/', import.meta.url))
const absoluteUrl = /(?:https?:|wss?:)?\/\/[\w-]+\.[\w.-]+/gi
const rules = {
  html: absoluteUrl,
  css: absoluteUrl,
  js: /(?:fetch|WebSocket|EventSource|import)\s*\(\s*["'`](?:https?:|wss?:)?\/\//gi,
}

const files = readdirSync(dist, { recursive: true }).map(String)
if (!files.includes('index.html')) throw new Error(`${dist} has no index.html: run the build first`)
const offences = files.flatMap((file) => {
  const rule = rules[file.split('.').pop()]
  return rule ? [...readFileSync(join(dist, file), 'utf8').matchAll(rule)].map((m) => `${file}: ${m[0]}`) : []
})

if (offences.length) {
  console.error(`The bundle loads from external domains:\n${offences.join('\n')}`)
  process.exit(1)
}
console.log(`${files.length} files checked, nothing loaded from external domains`)
