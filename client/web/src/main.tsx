import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
// The font comes from the bundle, never from a CDN: Gotion calls no external service at run time (BR-01)
import '@fontsource-variable/inter'
import './style.css'
import { setUnauthorizedHandler } from './api/client'
import { SignIn } from './routes/SignIn'
import { Directory } from './routes/Directory'
import { Page } from './routes/Page'

const router = createBrowserRouter([
  { path: '/sign-in', element: <SignIn /> },
  { path: '/', element: <Directory /> },
  { path: '/workspaces/:workspaceId', element: <Page /> },
  { path: '/workspaces/:workspaceId/pages/:pageId', element: <Page /> },
])

setUnauthorizedHandler(() => {
  if (router.state.location.pathname !== '/sign-in') void router.navigate('/sign-in')
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
