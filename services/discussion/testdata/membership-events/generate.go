package adapters

// Generating the types of an event of Membership, which ADR-03 forbids in Discussion.
//go:generate go tool go-jsonschema -p adapters -o membership_events.go ../../../membership/api/events/member-removed.v1.json
