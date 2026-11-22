// check-bundle.mjs on a small bundle written for each case
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'

const script = new URL('../check-bundle.mjs', import.meta.url).pathname

// Writes a bundle of a plain index.html and these files, and tells whether the check lets it through
function passes(files: Record<string, string>) {
  const dist = mkdtempSync(join(tmpdir(), 'bundle-'))
  const bundle = { 'index.html': '<!doctype html><script type="module" src="/assets/index.js"></script>', ...files }
  for (const [name, content] of Object.entries(bundle)) writeFileSync(join(dist, name), content)
  try {
    execFileSync(process.execPath, [script, dist], { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

test.each<[string, boolean, Record<string, string>]>([
  ['a bundle that loads only from its own origin', true, {}],
  ['a string that only names an external URL', true, { 'index.js': 'throw Error("see https://react.dev/errors/1")' }],
  ['a fetch of an external URL', false, { 'index.js': 'fetch("https://api.example.com/x")' }],
  ['an external image in a srcset', false, { 'index.html': '<img srcset="/a.png 1x, https://cdn.example.com/a.png 2x">' }],
  ['a protocol-relative stylesheet', false, { 'index.html': '<link rel="stylesheet" href="//cdn.example.com/a.css">' }],
  ['an external font in the CSS', false, { 'index.css': '@font-face{src:url(https://cdn.example.com/inter.woff2)}' }],
])('%s passes: %s', (_case, expected, files) => {
  expect(passes(files)).toBe(expected)
})
