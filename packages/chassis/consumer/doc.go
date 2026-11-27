// Package consumer gives the services the router of their Kafka consumers, built on Watermill with watermill-kafka. It records the identifier in the envelope of each applied event in the transaction of its change, in the table of Schema, and skips a repeated one.
package consumer
