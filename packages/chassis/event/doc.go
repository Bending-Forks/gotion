// Package event gives the services the envelope of every event, generated with go-jsonschema from api/envelope.schema.json, and the synchronous Kafka publisher of Watermill with watermill-kafka, which keys each event by the identity of its aggregate.
package event

//go:generate go tool go-jsonschema --struct-name-from-title -p event -o envelope.go ../../../api/envelope.schema.json
