// The types of src/api/generated/ come from the OpenAPI specifications of the services through `npm run gen:api`, and are never edited by hand (ADR-08)
import type { components as account } from './generated/account'
import type { components as membership } from './generated/membership'

export type Credentials = account['schemas']['Credentials']

export type Workspace = account['schemas']['Workspace']

export type Role = membership['schemas']['Role']

export type Member = membership['schemas']['Member']

export type Invitation = membership['schemas']['Invitation']

// shortcut: the gateway has no specification yet, so the Workspace directory it composes from Membership and Account (API Composition) is written here; generate it once the gateway has its openapi.yaml.
export type DirectoryEntry = Workspace & { role: Role; main: boolean }
export type Directory = { workspaces: DirectoryEntry[] }

// RFC 9457, the error body of every service
export type Problem = account['schemas']['Problem']
