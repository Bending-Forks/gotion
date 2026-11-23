import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { buildServer } from './http.ts';

let kafkaUp = true;
const app = await buildServer({
  logLevel: 'silent',
  ready: {
    database: async () => {},
    kafka: async () => {
      if (!kafkaUp) throw new Error('unreachable');
    },
  },
});
after(() => app.close());

test('liveness answers whatever the dependencies', async () => {
  kafkaUp = false;
  const response = await app.inject('/health/live');
  assert.equal(response.statusCode, 200);
});

test('readiness answers 200 when every check passes', async () => {
  kafkaUp = true;
  const response = await app.inject('/health/ready');
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { database: 'up', kafka: 'up' });
});

test('readiness answers 503 and names the dependency down', async () => {
  kafkaUp = false;
  const response = await app.inject('/health/ready');
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), { database: 'up', kafka: 'down' });
});

test('/metrics serves the metrics in the Prometheus format', async () => {
  await app.inject('/health/live');
  const response = await app.inject('/metrics');
  assert.equal(response.statusCode, 200);
  assert.match(response.body, /^http_request_duration_seconds_count\{.*route="\/health\/live".*\} \d+$/m);
});
