// Reads the configuration, builds the adapters and connects them to the ports.
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { readConfig } from './adapters/config.ts';
import { buildServer } from './adapters/http.ts';
import { createProducer, reachable } from './adapters/kafka.ts';
import { migrate } from './adapters/postgres.ts';

const config = readConfig(process.env);
const pool = new Pool({ connectionString: config.databaseUrl, connectionTimeoutMillis: 2000 });
const producer = createProducer(config.kafkaBrokers);

const app = await buildServer({
  logLevel: config.logLevel,
  ready: { database: () => pool.query('SELECT 1'), kafka: reachable(producer) },
});
app.addHook('onClose', async () => {
  await producer.disconnect();
  await pool.end();
});

await migrate(config.databaseUrl, fileURLToPath(new URL('../migrations', import.meta.url)), app.log);
await producer.connect();
await app.listen({ host: '0.0.0.0', port: config.port });

// Kubernetes stops a pod with SIGTERM: Fastify finishes the requests in flight, then the hook above closes Kafka and the pool.
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => void app.close());
