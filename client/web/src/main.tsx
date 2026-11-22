import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
// The font comes from the bundle, never from a CDN: Gotion calls no external service at run time (BR-01)
import '@fontsource-variable/inter'
import './style.css'
import { SignIn, signIn } from './routes/SignIn'
import { SignUp, signUp } from './routes/SignUp'
import { Directory, createWorkspace, directory } from './routes/Directory'
import { Workspace, workspace } from './routes/Workspace'
import { Settings, manage, settings } from './routes/Settings'
import { RouteError } from './routes/RouteError'

// The page carries the editor, the bulk of the bundle, so it loads only when a page opens
const page = { lazy: async () => ({ Component: (await import('./routes/Page')).Page }) }

// Loaders and actions call the gateway; the root route shows what any of them throws, and waits for the first one
const router = createBrowserRouter([
  {
    ErrorBoundary: RouteError,
    HydrateFallback: () => <p>Loading…</p>,
    children: [
      { path: '/sign-in', Component: SignIn, action: signIn },
      { path: '/sign-up', Component: SignUp, action: signUp },
      { path: '/', Component: Directory, loader: directory, action: createWorkspace },
      {
        id: 'workspace',
        path: '/workspaces/:workspaceId',
        Component: Workspace,
        loader: workspace,
        children: [
          { index: true, ...page },
          { path: 'pages/:pageId', ...page },
          { path: 'settings', Component: Settings, loader: settings, action: manage },
        ],
      },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
