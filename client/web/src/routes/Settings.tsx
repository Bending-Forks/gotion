import type { FormEvent } from 'react'
import { Form, redirect, useActionData, useLoaderData, useSubmit, type Params } from 'react-router'
import { LogOut, Trash, UserPlus } from 'lucide-react'
import { call, formAction } from '../api/client'
import type { Invitation, Member, Role } from '../api/types'
import { User } from '../components/User'
import { useWorkspace } from './Workspace'

const roles: Role[] = ['Admin', 'Editor', 'Viewer']

// The members and the pending invitations of the workspace (US-03)
export async function settings({ params }: { params: Params }) {
  const path = `/v1/workspaces/${params.workspaceId}`
  const [{ members }, { invitations }] = await Promise.all([
    call<{ members: Member[] }>('GET', `${path}/members`),
    call<{ invitations: Invitation[] }>('GET', `${path}/invitations`),
  ])
  return { members, invitations }
}

// The commands of the settings, one per form, told apart by their intent; Account and Membership check the role (US-02, US-03)
export const manage = formAction(async ({ params, request }: { params: Params; request: Request }) => {
  const form = await request.formData()
  const field = (name: string) => String(form.get(name))
  const workspace = `/v1/workspaces/${params.workspaceId}`
  switch (field('intent')) {
    case 'rename':
      await call('PATCH', workspace, { name: field('name') })
      return null
    case 'invite':
      await call('POST', `${workspace}/invitations`, { email: field('email'), role: field('role') })
      return null
    case 'role':
      await call('PUT', `${workspace}/members/${field('memberId')}/role`, { role: field('role') })
      return null
    case 'remove':
      await call('DELETE', `${workspace}/members/${field('memberId')}`)
      return null
    // Without the workspace the directory opens another one, or stays empty
    case 'delete':
      await call('DELETE', workspace)
      return redirect('/')
    case 'leave':
      await call('POST', `${workspace}/leave`)
      return redirect('/')
  }
  throw new Error(`${field('intent')} is not a command of the settings`)
})

// Asks before a command that cannot be undone
const confirming = (question: string) => (e: FormEvent) => confirm(question) || e.preventDefault()

export function Settings() {
  const { members, invitations } = useLoaderData<typeof settings>()
  const problem = useActionData<string>()
  const { current } = useWorkspace()
  const admin = current.role === 'Admin'
  const submit = useSubmit()
  return (
    <main className="settings">
      <h1>Settings and members</h1>
      {problem && <p role="alert">{problem}</p>}

      <section>
        <h2>Workspace</h2>
        {admin ? (
          <Form method="post" className="inline-form">
            <input name="name" aria-label="Workspace name" defaultValue={current.name} required />
            <button type="submit" name="intent" value="rename">
              Rename
            </button>
          </Form>
        ) : (
          <p>{current.name}</p>
        )}
      </section>

      <section>
        <h2>Members</h2>
        <ul className="rows">
          {members.map((m) => (
            <li key={m.userId}>
              <User userId={m.userId} />
              {admin ? (
                <>
                  <Form method="post">
                    <input type="hidden" name="intent" value="role" />
                    <input type="hidden" name="memberId" value={m.userId} />
                    <select name="role" aria-label="Role" defaultValue={m.role} onChange={(e) => submit(e.currentTarget.form)}>
                      {roles.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </Form>
                  <Form method="post" onSubmit={confirming('Remove this member from the workspace?')}>
                    <input type="hidden" name="memberId" value={m.userId} />
                    <button type="submit" name="intent" value="remove">
                      Remove
                    </button>
                  </Form>
                </>
              ) : (
                <span className="muted">{m.role}</span>
              )}
            </li>
          ))}
        </ul>
        <Form method="post" onSubmit={confirming('Leave this workspace?')}>
          <button type="submit" name="intent" value="leave">
            <LogOut aria-hidden size={16} /> Leave workspace
          </button>
        </Form>
      </section>

      <section>
        <h2>Invitations</h2>
        {admin && (
          <Form method="post" className="inline-form">
            <input name="email" type="email" aria-label="Email of the invitee" placeholder="Email" required />
            <select name="role" aria-label="Role of the invitee" defaultValue="Editor">
              {roles.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
            <button type="submit" name="intent" value="invite">
              <UserPlus aria-hidden size={16} /> Invite
            </button>
          </Form>
        )}
        {invitations.length === 0 ? (
          <p className="muted">No pending invitations</p>
        ) : (
          <ul className="rows">
            {invitations.map((i) => (
              <li key={i.inviteeId}>
                <User userId={i.inviteeId} /> <span className="muted">{i.role}, pending</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {admin && (
        <section>
          <h2>Danger zone</h2>
          <Form method="post" onSubmit={confirming(`Delete ${current.name} with all its pages and discussions?`)}>
            <button type="submit" name="intent" value="delete" className="danger">
              <Trash aria-hidden size={16} /> Delete workspace
            </button>
          </Form>
        </section>
      )}
    </main>
  )
}
