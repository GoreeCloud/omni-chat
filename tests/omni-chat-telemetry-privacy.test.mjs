import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const load = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const dependency = '@opentelemetry/instrumentation-mongoose';
const advisory = 'GHSA-qqmp-wf37-98f9';

function assertPatched(value, context) {
  assert.equal(typeof value, 'string', context + ' must explicitly declare the instrumentation');
  const match = value.match(/^[~^]?(\d+)\.(\d+)\.(\d+)$/);
  assert.ok(match, context + ' must declare a bounded semantic version');
  const [, major, minor] = match.map(Number);
  assert.ok(major > 0 || minor >= 67, context + ' must not regress ' + advisory);
}

test('Mongoose telemetry dependency stays above the database-user privacy advisory floor', () => {
  const api = load('api/package.json');
  const sharedApi = load('packages/api/package.json');
  const lock = load('package-lock.json');
  assertPatched(api.dependencies[dependency], 'backend API dependency');
  assertPatched(sharedApi.peerDependencies[dependency], 'shared API peer dependency');
  assertPatched(
    lock.packages['node_modules/@opentelemetry/instrumentation-mongoose']?.version,
    'resolved lockfile dependency',
  );
});
