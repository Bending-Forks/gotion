package adapters

// handle applies an event of Membership, which ADR-03 forbids in Discussion.
func handle(eventType string) bool {
	return eventType == "MemberRemoved"
}
