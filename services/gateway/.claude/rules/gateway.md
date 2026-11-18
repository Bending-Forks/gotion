# API gateway

- Check and test from the root of the repository: `go vet ./services/gateway/... && go test ./services/gateway/...`.
- No domain and no database: no `domain/`, `app/` or `migrations/`, and it imports neither `postgres/` nor `outbox/` of the chassis.
- `internal/proxy/` forwards the requests of the client to the services, and the WebSocket of page `P` to the Editing instance `hash(P) mod N`, with `net/http/httputil.ReverseProxy`.
- `internal/directory/` composes the Workspace directory from the queries to Membership and Account (API Composition).
- Every request and every WebSocket upgrade has its sign-in token checked, accepting only EdDSA; any `X-User-Id` sent by the client is replaced with the `sub` of the token, and an upgrade from a foreign `Origin` is refused (ADR-09).
