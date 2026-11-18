# Notification

- Check and test from the root of the repository: `go vet ./services/notification/... && go test ./services/notification/...`.
- In-app notifications of invitations and mentions (US-10).
- It publishes nothing, so it has no outbox (ADR-05), and it asks no other service.
- Member Invited and Comment Posted are consumed through an anticorruption layer that turns them into its own `Subject`, an invitation or a mention.
