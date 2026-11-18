# Discussion

- Check and test from the root of the repository: `go vet ./services/discussion/... && go test ./services/discussion/...`.
- Comment threads on pages and blocks (US-09).
- Comment Posted goes through the transactional outbox of the chassis, never straight to Kafka (ADR-05).
- Membership is asked with one query per command whether the users involved are members; Discussion consumes no event of Membership (ADR-03).
- Page Deleted and Block Deleted from Editing are consumed as a conformist, to delete the threads anchored to them.
