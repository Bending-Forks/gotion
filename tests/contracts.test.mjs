import assert from 'node:assert/strict';
import { globSync } from 'node:fs';
import { relative } from 'node:path';
import { test } from 'node:test';
import { createConfig, lint } from '@redocly/openapi-core';

// Every service keeps its specifications in services/<service>/api/ (Contracts, in Design). Redocly checks
// OpenAPI 3.1 and AsyncAPI 3.0 alike, and follows the $ref to the envelope and to the bodies in events/.
const root = new URL('..', import.meta.url).pathname;
const config = await createConfig({ extends: ['minimal'] });

for (const file of globSync('services/*/api/{openapi,asyncapi}.yaml', { cwd: root })) {
  test(`${file} is a valid specification`, async () => {
    const problems = await lint({ ref: root + file, config });
    const errors = problems
      .filter((p) => p.severity === 'error')
      .map(({ ruleId, message, location: [at] }) => `${ruleId}: ${message} at ${relative(root, at.source.absoluteRef)}${at.pointer}`);
    assert.deepEqual(errors, []);
  });
}
