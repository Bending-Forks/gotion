import confluent from '@confluentinc/kafka-javascript';

export type Producer = confluent.KafkaJS.Producer;

// The producer of Editing, which publishes its events directly, with no outbox (ADR-05).
export function createProducer(brokers: string[]): Producer {
  return new confluent.KafkaJS.Kafka({ kafkaJS: { brokers } }).producer();
}

// Readiness requires Kafka, because an event Editing cannot publish is lost (Observability): the producer must reach the cluster.
export function reachable(producer: Producer): () => Promise<string> {
  return () => producer.clusterId({ timeout: 2000 });
}
