import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const schema = JSON.parse(readFileSync(new URL('../api/envelope.schema.json', import.meta.url)));
const validate = addFormats(new Ajv({ allErrors: true })).compile(schema);

test('accepts the example of the envelope', () => {
  for (const example of schema.examples) {
    assert.ok(validate(example), JSON.stringify(validate.errors));
  }
});

test('refuses an event without its envelope', () => {
  // The body of the event put where the envelope should be, as a producer might send its own object
  const invalid = {
    eventId: 'not-a-uuid',
    type: 'workspace created',
    version: 0,
    workspaceId: '8f14e45f-ceea-467a-9575-1b4f0c3a2d11',
  };
  assert.equal(validate(invalid), false);
  const failed = validate.errors.map((e) => e.instancePath || e.params.missingProperty);
  for (const field of ['/eventId', '/type', '/version', 'aggregateId', 'occurredAt', 'data']) {
    assert.ok(failed.includes(field), `${field} not reported in ${JSON.stringify(failed)}`);
  }
});
