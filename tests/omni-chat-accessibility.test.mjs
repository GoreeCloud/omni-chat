import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('Omni Chat unauthenticated client accessibility smoke', { timeout: 90000 }, async (t) => {
  const port = 4179;
  const url = 'http://127.0.0.1:' + port + '/login';
  const processHandle = spawn(process.execPath, [
    resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1',
    '--port', String(port), '--strictPort'
  ], { cwd: resolve('client'), stdio: 'ignore' });
  t.after(() => processHandle.kill('SIGTERM'));
  let ready = false;
  for (let i = 0; i < 40; i += 1) {
    if (processHandle.exitCode !== null) break;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.ok) { ready = true; break; }
    } catch { /* server not ready */ }
    await delay(250);
  }
  assert.ok(ready, 'production preview server must be available');
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ colorScheme: 'light' });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.getByText('Omni Chat', { exact: true }).first().waitFor({
    state: 'visible', timeout: 25000,
  });
  assert.equal(await page.title(), 'Omni Chat');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const violations = results.violations.map(({ id, impact, nodes }) => ({
    id, impact, targets: nodes.map((node) => node.target),
  }));
  assert.deepEqual(violations, [], 'Detected accessibility violations: ' + JSON.stringify(violations));
});
