import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
// The font comes from the bundle, never from a CDN: Gotion calls no external service at run time (BR-01)
import '@fontsource-variable/inter'
import './style.css'
import { SignIn, signIn } from './routes/SignIn'
import { Directory, directory, openWorkspace } from './routes/Directory'
import { Page } from './routes/Page'
import { RouteError } from './routes/RouteError'

// Loaders and actions call the gateway; the root route shows what any of them throws, and waits for the first one
const router = createBrowserRouter([
  {
    ErrorBoundary: RouteError,
    HydrateFallback: () => <p>Loading…</p>,
    children: [
      { path: '/sign-in', Component: SignIn, action: signIn },
      { path: '/', Component: Directory, loader: directory, action: openWorkspace },
      { path: '/workspaces/:workspaceId', Component: Page },
      { path: '/workspaces/:workspaceId/pages/:pageId', Component: Page },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
