import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const asset = (name) => readFileSync(resolve(root, 'client/public/assets', name));

test('Omni Chat logo describes an AI agent instead of a messenger', () => {
  const svg = asset('omni-chat-mark.svg').toString('utf8');
  assert.match(svg, /<title[^>]*>Omni Chat AI assistant<\/title>/);
  assert.match(svg, /id="omni-agent-face"/);
  assert.match(svg, /antenna/);
  assert.doesNotMatch(svg, /speech bubble|message bubble|messenger/i);
  assert.match(readFileSync(resolve(root, 'client/src/components/Auth/AuthLayout.tsx'), 'utf8'),
    /assets\/omni-chat-mark\.svg/);
});

test('PWA, browser and touch icons are valid branded PNGs in all required sizes', () => {
  for (const [name, size] of [
    ['favicon-16x16.png', 16],
    ['favicon-32x32.png', 32],
    ['apple-touch-icon-180x180.png', 180],
    ['icon-192x192.png', 192],
    ['maskable-icon.png', 512],
  ]) {
    const png = asset(name);
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', name);
    assert.equal(png.readUInt32BE(16), size, `${name}: width`);
    assert.equal(png.readUInt32BE(20), size, `${name}: height`);
    assert.ok(png.byteLength > 100, `${name}: empty icon`);
  }
  const manifest = readFileSync(resolve(root, 'client/vite.config.ts'), 'utf8');
  assert.match(manifest, /src: 'assets\/maskable-icon\.png'/);
  assert.match(manifest, /purpose: 'maskable'/);
  assert.match(manifest, /src: 'assets\/icon-192x192\.png'/);
});
