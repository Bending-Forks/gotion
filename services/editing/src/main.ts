// Reads the configuration, builds the adapters and connects them to the ports.
import { fileURLToPath } from 'node:url';
import { readConfig } from './adapters/config.ts';
import { buildServer } from './adapters/http.ts';
import { createProducer } from './adapters/kafka.ts';
import { createPool, migrate } from './adapters/postgres.ts';

const config = readConfig(process.env);
const ready = { database: () => pool.query('SELECT 1'), kafka: () => kafka.reachable() };

const app = await buildServer({ logLevel: config.logLevel, ready });
const pool = createPool(config.databaseUrl, app.log);
const kafka = createProducer(config.kafkaBrokers, app.log);
app.addHook('onClose', async () => {
  await kafka.disconnect();
  await pool.end();
});

// Kubernetes stops a pod with SIGTERM: Fastify finishes the requests in flight, then the hook above closes Kafka and the pool.
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => void app.close());

await migrate(config.databaseUrl, fileURLToPath(new URL('../migrations', import.meta.url)), app.log);
// Listening before Kafka is connected keeps liveness free of Kafka; readiness answers that Kafka is down until it is.
await app.listen({ host: '0.0.0.0', port: config.port });
await kafka.connect();
