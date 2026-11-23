import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { cruise } from 'dependency-cruiser';
import config from '../.dependency-cruiser.mjs';

// fixtures/fitness/ mirrors the folders of the repository with one violation of each fitness function of
// .dependency-cruiser.mjs, so a rule that no longer matches the paths it governs fails here.
test('every fitness function of the TypeScript packages fails on its violation', async () => {
  const { output } = await cruise(['.'], {
    ...config.options,
    baseDir: fileURLToPath(new URL('fixtures/fitness/', import.meta.url)),
    validate: true,
    ruleSet: { forbidden: config.forbidden },
  });
  const failed = new Set(output.summary.violations.map((v) => v.rule.name));
  assert.deepEqual([...failed].sort(), config.forbidden.map((r) => r.name).sort());
});
