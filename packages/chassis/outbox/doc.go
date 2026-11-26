// Package outbox gives the services the transactional outbox and its Polling Publisher, built on watermill-sql and the Forwarder of Watermill, which publish each event to Kafka keyed by its aggregate.
// A command writes its events with Publish in its own transaction, into the tables of Schema; the Forwarder sends them in the order of their transactions, one replica at a time.
// Only the task that deletes the old sent rows and the metrics of the pending ones are ours.
package outbox
