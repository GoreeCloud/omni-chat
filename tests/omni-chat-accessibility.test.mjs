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
  const processHandle = spawn(
    process.execPath,
    [
      resolve('node_modules/vite/bin/vite.js'),
      'preview',
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort',
    ],
    { cwd: resolve('client'), stdio: 'ignore' },
  );
  t.after(() => processHandle.kill('SIGTERM'));
  let ready = false;
  for (let i = 0; i < 40; i += 1) {
    if (processHandle.exitCode !== null) break;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      /* server not ready */
    }
    await delay(250);
  }
  assert.ok(ready, 'production preview server must be available');
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const renderModes = [
    { name: 'desktop light', viewport: { width: 1280, height: 800 }, colorScheme: 'light' },
    { name: 'mobile dark', viewport: { width: 390, height: 844 }, colorScheme: 'dark' },
  ];
  for (const mode of renderModes) {
    const context = await browser.newContext({
      viewport: mode.viewport,
      colorScheme: mode.colorScheme,
      reducedMotion: 'reduce',
    });
    try {
      const page = await context.newPage();
      await page.route('**/api/config*', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            appTitle: 'Omni Chat',
            emailLoginEnabled: true,
            registrationEnabled: false,
            socialLoginEnabled: false,
            passkeyLoginEnabled: false,
            passwordResetEnabled: false,
            serverDomain: 'http://127.0.0.1:4179',
          }),
        }),
      );
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.getByText('Omni Chat', { exact: true }).first().waitFor({
        state: 'visible',
        timeout: 25000,
      });
      assert.equal(await page.title(), 'Omni Chat', mode.name);
      await page.getByRole('form', { name: 'Login form' }).waitFor({ state: 'visible' });
      assert.equal(await page.locator('#email').isVisible(), true, mode.name + ' email input');
      assert.equal(
        await page.locator('#password').isVisible(),
        true,
        mode.name + ' password input',
      );
      // Verify the bounded Omni Chat presentation bridge in the rendered UI.
      const rootStyle = await page.locator('html').evaluate((root) => ({
        product: root.getAttribute('data-product'),
        radius: getComputedStyle(root).getPropertyValue('--omni-radius').trim(),
        scrollBehavior: getComputedStyle(root).scrollBehavior,
      }));
      assert.equal(rootStyle.product, 'omni-chat', mode.name);
      assert.equal(Number.parseFloat(rootStyle.radius), 0.875, mode.name + ' scoped radius');
      assert.ok(rootStyle.radius.endsWith('rem'), mode.name + ' radius unit');
      assert.equal(rootStyle.scrollBehavior, 'auto', mode.name + ' reduced motion');
      const unfocusedStyle = await page.locator('#email').evaluate((input) => ({
        shadow: getComputedStyle(input).boxShadow,
      }));
      await page.keyboard.press('Tab');
      await page.locator('#email').focus();
      const focusStyle = await page.locator('#email').evaluate((input) => {
        const style = getComputedStyle(input);
        return {
          visible: input.matches(':focus-visible'),
          modality: document.documentElement.dataset.inputModality,
          width: style.outlineWidth,
          outlineStyle: style.outlineStyle,
          shadow: style.boxShadow,
        };
      });
      assert.equal(focusStyle.modality, 'keyboard', mode.name + ' keyboard modality');
      assert.equal(focusStyle.visible, true, mode.name + ' keyboard focus');
      // Inputs use Tailwind's focus ring with the native outline hidden;
      // other theme roles may provide a solid outline instead. Require
      // an actual changed visual indicator rather than one implementation.
      const hasOutline =
        focusStyle.outlineStyle !== 'none' && Number.parseFloat(focusStyle.width) >= 2;
      const hasRing = focusStyle.shadow !== 'none' && focusStyle.shadow !== unfocusedStyle.shadow;
      assert.ok(
        hasOutline || hasRing,
        mode.name + ' needs an outline or a focus-only CSS ring: ' + JSON.stringify(focusStyle),
      );
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const violations = results.violations.map(({ id, impact, nodes }) => ({
        id,
        impact,
        targets: nodes.map((node) => node.target),
      }));
      assert.deepEqual(violations, [], mode.name + ': ' + JSON.stringify(violations));

      // Invalid empty submissions must be rejected before a network login request.
      await page.getByTestId('login-button').click();
      await page.getByRole('alert').first().waitFor({ state: 'visible' });
      assert.equal(await page.locator('#email').getAttribute('aria-invalid'), 'true');
      assert.equal(await page.locator('#password').getAttribute('aria-invalid'), 'true');
      assert.ok((await page.getByRole('alert').count()) >= 2, mode.name + ': field errors');
      const invalidResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const invalidViolations = invalidResults.violations.map(({ id, impact, nodes }) => ({
        id,
        impact,
        targets: nodes.map((node) => node.target),
      }));
      assert.deepEqual(
        invalidViolations,
        [],
        mode.name + ' invalid form: ' + JSON.stringify(invalidViolations),
      );
    } finally {
      await context.close();
    }
  }
});
