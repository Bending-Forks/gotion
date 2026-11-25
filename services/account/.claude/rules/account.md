# Account

- Check and test from the root of the repository: `go vet ./services/account/... && go test ./services/account/...`.
- Users and workspaces (US-01, US-02). Sign in signs the JWT with Ed25519 through the `token/` package of the chassis and sets it in the `HttpOnly` cookie; the token carries only the identity of the user (ADR-09). Only Account and the gateway import `token/`.
- Events go through the transactional outbox of the chassis, in the transaction of the command, never straight to Kafka (ADR-05).
- Rename, Delete and Open workspace first ask Membership for the role of the user; a query that fails refuses the command.

## State

The Register command and its first-workspace policy are in `domain/` and `app/` (US-01), tested with in-memory ports. `api/` has the OpenAPI and AsyncAPI specifications. No adapters yet, and `main.go` is empty.
