// Package outbox gives the services the transactional outbox and its Polling Publisher, built on watermill-sql and the Forwarder of Watermill, which publish each event to Kafka keyed by its aggregate. Only the task that deletes the old rows and the metrics of the pending ones are ours.
package outbox
