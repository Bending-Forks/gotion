// shortcut: written by hand from the OpenAPI specifications of Account and Membership in PR #36; once they are on main, `npm run gen:api` generates them into src/api/generated/ and these become aliases of the generated ones.

export type Credentials = { email: string; password: string }

export type Role = 'Admin' | 'Editor' | 'Viewer'

// The Workspace directory that the gateway composes from Membership and Account (API Composition)
export type Directory = {
  workspaces: { workspaceId: string; name: string; role: Role; main: boolean }[]
}

// RFC 9457, the error body of every service
export type Problem = { type?: string; title: string; status: number; detail?: string }
