import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readConfig } from './config.ts';

const required = { DATABASE_URL: 'postgres://editing@db/editing', KAFKA_BROKERS: 'kafka-0:9092,kafka-1:9092' };

test('reads the required variables and defaults the others', () => {
  assert.deepEqual(readConfig(required), {
    port: 8080,
    logLevel: 'info',
    databaseUrl: 'postgres://editing@db/editing',
    kafkaBrokers: ['kafka-0:9092', 'kafka-1:9092'],
  });
});

test('takes an empty optional variable as unset', () => {
  const config = readConfig({ ...required, PORT: '', LOG_LEVEL: '' });
  assert.equal(config.port, 8080);
  assert.equal(config.logLevel, 'info');
});

test('refuses to start without a required variable', () => {
  for (const name of Object.keys(required)) {
    assert.throws(() => readConfig({ ...required, [name]: '' }), new RegExp(`${name} is not set`));
  }
});
