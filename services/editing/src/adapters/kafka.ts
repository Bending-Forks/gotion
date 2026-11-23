import confluent from '@confluentinc/kafka-javascript';
import type { FastifyBaseLogger } from 'fastify';

// The producer of Editing, which publishes its events directly, with no outbox (ADR-05).
export function createProducer(brokers: string[], log: FastifyBaseLogger) {
  const producer = new confluent.KafkaJS.Kafka({ kafkaJS: { brokers, logger: kafkaLogger(log) } }).producer();
  const admin = producer.dependentAdmin();
  let closing = false;
  return {
    producer,
    // The client retries until a broker answers; a stop in the meantime aborts the connection, which is then no error.
    async connect(): Promise<void> {
      try {
        await producer.connect();
        await admin.connect();
      } catch (err) {
        if (!closing) throw err;
      }
    },
    async disconnect(): Promise<void> {
      closing = true;
      await admin.disconnect();
      await producer.disconnect();
    },
    // Readiness requires Kafka, because an event Editing cannot publish is lost (Observability). Listing the topics asks a broker, where the cluster id the producer also has would come from its cache.
    reachable: () => admin.listTopics({ timeout: 2000 }),
  };
}

// The client of Confluent writes its logs through pino, so they are JSON on the standard output like the others.
function kafkaLogger(log: FastifyBaseLogger): confluent.KafkaJS.Logger {
  const logger: confluent.KafkaJS.Logger = {
    info: (message, extra) => log.info(extra, message),
    error: (message, extra) => log.error(extra, message),
    warn: (message, extra) => log.warn(extra, message),
    debug: (message, extra) => log.debug(extra, message),
    namespace: () => logger,
    setLogLevel: () => {},
  };
  return logger;
}
