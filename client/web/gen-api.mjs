// Generates the TypeScript types of the client API of each service from its OpenAPI specification, into src/api/generated/: they are committed and never edited by hand (ADR-08).
import { existsSync, readdirSync, writeFileSync } from 'node:fs'
import openapiTS, { astToString } from 'openapi-typescript'

const services = new URL('../../services/', import.meta.url)
for (const service of readdirSync(services)) {
  const spec = new URL(`${service}/api/openapi.yaml`, services)
  if (!existsSync(spec)) continue
  writeFileSync(new URL(`./src/api/generated/${service}.ts`, import.meta.url), astToString(await openapiTS(spec)))
  console.log(`src/api/generated/${service}.ts`)
}
