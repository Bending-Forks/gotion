// Generates the TypeScript types of the client API of each service from its OpenAPI specification, into src/api/generated/: they are committed and never edited by hand (ADR-08).
import { mkdirSync, readdirSync, existsSync, writeFileSync } from 'node:fs'
import openapiTS, { astToString } from 'openapi-typescript'

const services = new URL('../../services/', import.meta.url)
const out = new URL('./src/api/generated/', import.meta.url)
const specs = existsSync(services)
  ? readdirSync(services).filter((s) => existsSync(new URL(`${s}/api/openapi.yaml`, services)))
  : []

if (specs.length === 0) console.log('no OpenAPI specification under services/ yet, nothing to generate')
mkdirSync(out, { recursive: true })
for (const service of specs) {
  const ast = await openapiTS(new URL(`${service}/api/openapi.yaml`, services))
  writeFileSync(new URL(`${service}.ts`, out), astToString(ast))
  console.log(`src/api/generated/${service}.ts`)
}
