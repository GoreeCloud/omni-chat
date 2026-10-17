import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url)));

test('Mammoth no longer resolves the unpatched argparse/sprintf-js chain', () => {
  assert.equal(manifest.overrides.mammoth.argparse, '^2.0.1');
  assert.equal(lock.packages['node_modules/argparse']?.version, '2.0.1');
  assert.equal(
    lock.packages['node_modules/mammoth/node_modules/argparse'],
    undefined,
    'Mammoth must use the root parser instead of a vulnerable nested copy',
  );
  assert.equal(
    lock.packages['node_modules/sprintf-js'],
    undefined,
    'remove vulnerable sprintf-js when no dependency needs it',
  );
});
