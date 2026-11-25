# Membership

- Check and test from the root of the repository: `go vet ./services/membership/... && go test ./services/membership/...`.
- Members, roles and invitations (US-03), one `Workspace Membership` per workspace.
- Events go through the transactional outbox of the chassis, in the transaction of the command, never straight to Kafka (ADR-05).
- A workspace that does not exist is answered as one the user is not a member of (QA-06).
- Invite member first asks Account for the `UserId` of the email address; a query that fails refuses the command.

## State

Only the skeleton and `api/`, with the OpenAPI and AsyncAPI specifications. `main.go` is empty.
