import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(root, '.github/workflows/playwright-mock.yml'), 'utf8');
const matrices = source.split('\n')
  .filter((line) => line.includes("fromJSON('{\"include\":"))
  .map((line) => {
    const begin = line.indexOf("fromJSON('") + "fromJSON('".length;
    const end = line.lastIndexOf("')");
    return JSON.parse(line.slice(begin, end)).include;
  });

test('full manually dispatched E2E shards cover all tests on both stores', () => {
  assert.equal(matrices.length, 2, 'expected PR and manual matrix declarations');
  const full = matrices[1];
  assert.equal(full.length, 14, 'six memory and eight redis shards');
  assert.equal(new Set(full.map((shard) => shard.artifact)).size, full.length);
  for (const [store, total] of [['memory', 6], ['redis', 8]]) {
    const shards = full.filter((shard) => shard.stream_store === store);
    assert.equal(shards.length, total, store);
    assert.deepEqual(shards.map((shard) => shard.shard),
      Array.from({ length: total }, (_, i) => `${i + 1}/${total}`));
    assert.ok(shards.every((shard) => shard.suite === 'full'));
    assert.ok(shards.every((shard) => shard.redis_image === (store === 'redis' ? 'redis:7-alpine' : '')));
  }
  assert.equal(full.filter((shard) => shard.email_change === 'true').length, 1);
  assert.equal(full[0].email_change, 'true');
});

test('PR suite preserves six memory and two redis transport shards', () => {
  const pr = matrices[0];
  assert.equal(pr.filter((shard) => shard.stream_store === 'memory').length, 6);
  const redis = pr.filter((shard) => shard.stream_store === 'redis');
  assert.equal(redis.length, 2);
  assert.ok(redis.every((shard) => shard.suite === 'transport'));
});
