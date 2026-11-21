import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Star } from 'lucide-react'
import { call } from '../api/client'
import type { Directory as DirectoryBody } from '../api/types'

// The workspaces of the signed-in user, in one request to the gateway (US-02)
export function Directory() {
  const navigate = useNavigate()
  const [directory, setDirectory] = useState<DirectoryBody>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    call<DirectoryBody>('GET', '/v1/directory').then(setDirectory, (e: Error) => setError(e.message))
  }, [])

  // Open workspace saves it as the user's main workspace in Account
  async function open(workspaceId: string) {
    try {
      await call('POST', `/v1/workspaces/${workspaceId}/open`)
      await navigate(`/workspaces/${workspaceId}`)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (error) return <p role="alert">{error}</p>
  if (!directory) return <p>Loading…</p>
  return (
    <main>
      <h1>Workspaces</h1>
      <ul>
        {directory.workspaces.map((w) => (
          <li key={w.workspaceId}>
            <button type="button" onClick={() => open(w.workspaceId)}>
              {w.name}
            </button>{' '}
            ({w.role}) {w.main && <Star aria-label="Main workspace" size={14} />}
          </li>
        ))}
      </ul>
    </main>
  )
}
