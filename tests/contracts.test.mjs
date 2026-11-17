import assert from 'node:assert/strict';
import { globSync } from 'node:fs';
import { test } from 'node:test';
import { Parser, fromFile } from '@asyncapi/parser';
import { createConfig, lint } from '@redocly/openapi-core';

// Every service keeps its specifications in services/<service>/api/ (Contracts, in Design)
const root = new URL('..', import.meta.url).pathname;
const specs = (name) => globSync(`services/*/api/${name}`, { cwd: root });

for (const file of specs('openapi.yaml')) {
  test(`${file} is a valid OpenAPI 3.1 specification`, async () => {
    const problems = await lint({ ref: root + file, config: await createConfig({ extends: ['minimal'] }) });
    const errors = problems.filter((p) => p.severity === 'error');
    assert.deepEqual(errors.map((p) => `${p.ruleId}: ${p.message} at ${p.location[0]?.pointer}`), []);
  });
}

for (const file of specs('asyncapi.yaml')) {
  test(`${file} is a valid AsyncAPI specification`, async () => {
    const { diagnostics } = await fromFile(new Parser(), root + file).parse();
    const errors = diagnostics.filter((d) => d.severity === 0);
    assert.deepEqual(errors.map((d) => `${d.code}: ${d.message} at ${d.path.join('/')}`), []);
  });
}
