import Fastify, { type FastifyInstance } from 'fastify';
import metrics from 'fastify-metrics';

// A check of readiness resolves when its dependency is usable and rejects otherwise.
export type Check = () => Promise<unknown>;

// The Fastify server of Editing with the routes every service has: liveness, readiness and /metrics (Observability). Logs are JSON on the standard output, by pino.
export async function buildServer(options: { logLevel: string; ready: Record<string, Check> }): Promise<FastifyInstance> {
  const app = Fastify({ logger: { level: options.logLevel } });
  await app.register(metrics.default, { endpoint: '/metrics' });

  // Kubernetes polls the checks every few seconds, so their requests are not logged, as fastify-metrics does for /metrics.
  const quiet = { logLevel: 'warn' } as const;

  // Liveness checks no dependency: restarting Editing does not bring its database back.
  app.get('/health/live', quiet, async () => ({ status: 'up' }));

  app.get('/health/ready', quiet, async (_request, reply) => {
    const names = Object.keys(options.ready);
    const results = await Promise.allSettled(Object.values(options.ready).map((check) => check()));
    const status = Object.fromEntries(names.map((name, i) => [name, results[i]?.status === 'fulfilled' ? 'up' : 'down']));
    return reply.code(Object.values(status).includes('down') ? 503 : 200).send(status);
  });

  return app;
}
