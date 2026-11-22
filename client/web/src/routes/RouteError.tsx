import { useRouteError } from 'react-router'

// What a loader or an action threw, other than a redirect: the problem of the gateway or a network error
export function RouteError() {
  const error = useRouteError()
  return <p role="alert">{error instanceof Error ? error.message : 'Something went wrong'}</p>
}
