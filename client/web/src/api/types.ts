// The types of src/api/generated/ come from the OpenAPI specifications of the services through `npm run gen:api`, and are never edited by hand (ADR-08)
import type { components as account } from './generated/account'
import type { components as membership } from './generated/membership'

export type Credentials = account['schemas']['Credentials']

export type Role = membership['schemas']['Role']

// shortcut: the gateway has no specification yet, so the Workspace directory it composes from Membership and Account (API Composition) is written here; generate it once the gateway has its openapi.yaml.
export type Directory = {
  workspaces: (account['schemas']['Workspace'] & { role: Role; main: boolean })[]
}

// RFC 9457, the error body of every service
export type Problem = account['schemas']['Problem']
