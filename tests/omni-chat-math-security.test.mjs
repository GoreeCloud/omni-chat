import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const load = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));

const patched = (version) => {
  const match = /^[~^]?(\d+)\.(\d+)\.(\d+)$/.exec(version ?? '');
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  return major > 0 || minor > 18 || (minor === 18 && patch >= 2);
};

test('math rendering dependencies stay above the KaTeX trust-bypass advisory floor', () => {
  const overrides = load('package.json').overrides;
  const lock = load('package-lock.json');
  const version = lock.packages['node_modules/katex']?.version;
  assert.ok(patched(version), 'resolved KaTeX must not reintroduce the trust-bypass advisory');
  assert.ok(patched(overrides.katex), 'global override must require a patched KaTeX');
  assert.ok(patched(overrides['rehype-katex'].katex), 'rehype-katex must use patched KaTeX');
  assert.ok(
    patched(overrides['remark-math']['micromark-extension-math'].katex),
    'math extension must use patched KaTeX',
  );
});
