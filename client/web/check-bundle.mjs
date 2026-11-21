// Fails if the built client would load anything from another domain: Gotion calls no external service at run time (BR-01).
// HTML and CSS must not reference an absolute URL at all; in JavaScript, URLs inside strings (such as the links of React's error messages) are allowed, a fetch, WebSocket or import of one is not.
import { readdirSync, readFileSync } from 'node:fs'

const dist = new URL('./dist/', import.meta.url)
const rules = {
  html: /(?:src|href)\s*=\s*["']?(?:https?:)?\/\//gi,
  css: /(?:url\(\s*["']?|@import\s+["']?)(?:https?:)?\/\//gi,
  js: /(?:fetch|WebSocket|EventSource|import)\s*\(\s*["'`](?:https?:|wss?:)?\/\//gi,
}

const files = readdirSync(dist, { recursive: true }).map(String)
if (!files.includes('index.html')) throw new Error('dist/index.html is missing: run the build first')
const offences = files.flatMap((file) => {
  const rule = rules[file.split('.').pop()]
  return rule ? [...readFileSync(new URL(file, dist), 'utf8').matchAll(rule)].map((m) => `${file}: ${m[0]}`) : []
})

if (offences.length) {
  console.error(`The bundle loads from external domains:\n${offences.join('\n')}`)
  process.exit(1)
}
console.log(`${files.length} files checked, nothing loaded from external domains`)
