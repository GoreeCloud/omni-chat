import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = (rel) => readFileSync(resolve(root, rel), 'utf8');

test('preserves upstream MIT license and source provenance', () => {
  assert.match(file('LICENSE'), /MIT License/);
  assert.match(file('docs/OMNI_CHAT_FORK_TO_NATIVE.md'), /LibreChat-AI\/LibreChat/);
});

test('browser shell and client default use Omni Chat identity', () => {
  const shell = file('client/index.html');
  assert.match(shell, /<title>Omni Chat<\/title>/);
  assert.match(shell, /data-product="omni-chat"/);
  assert.match(file('client/src/utils/documentTitle.ts'), /DEFAULT_APP_TITLE = 'Omni Chat'/);
  assert.match(file('client/src/main.jsx'), /import '\.\/omni-chat\.css'/);
  const scopedCss = file('client/src/omni-chat.css');
  assert.match(scopedCss, /--omni-radius:/);
  assert.doesNotMatch(
    scopedCss,
    /outline\s*:/,
    'Omni Chat identity CSS must not override theme-owned keyboard focus outlines',
  );
});

test('autofill keyboard focus preserves the theme-owned field ring', () => {
  const css = file('client/src/style.css');
  assert.match(
    css,
    /html:not\(\[data-input-modality='pointer'\]\) \.webkit-dark-styles\.lc-field:focus-visible/,
    'autofill focus ring must be keyboard-only',
  );
  assert.match(css, /--tw-ring-offset-shadow/);
  assert.match(css, /--tw-ring-shadow/);
  const field = file('packages/client/src/components/Field.ts');
  assert.match(field, /focus-visible:ring-2/);
  assert.match(field, /focus-visible:outline-hidden/);
});

test('installable app and sign-in surface use Omni Chat identity', () => {
  const vite = file('client/vite.config.ts');
  assert.match(vite, /name: 'Omni Chat'/);
  assert.match(vite, /short_name: 'Omni Chat'/);
  assert.doesNotMatch(vite, /short_name: 'LibreChat'/);
  const auth = file('client/src/components/Auth/AuthLayout.tsx');
  assert.match(auth, /assets\/omni-chat-mark\.svg/);
  assert.match(auth, /\{startupConfig\?\.appTitle \|\| 'Omni Chat'\}/);
  assert.doesNotMatch(auth, /src="assets\/logo\.svg"/);
});

test('model integration metadata and MCP bridge identify Omni Chat', () => {
  const openRouter = file('packages/api/src/endpoints/openai/config.ts');
  assert.match(openRouter, /'X-Title': 'Omni Chat'/);
  assert.match(openRouter, /'X-OpenRouter-Title': 'Omni Chat'/);
  assert.match(file('client/src/hooks/MCP/useAppBridge.ts'), /name: 'Omni Chat'/);
});

test('marketplace, insights, footer, and diagnostics use Omni Chat branding', () => {
  assert.match(file('client/src/components/Agents/Marketplace.tsx'), /\| Omni Chat/);
  assert.match(file('client/src/components/Insights/InsightsView.tsx'), /\| Omni Chat/);
  assert.match(file('client/src/components/Chat/Footer.tsx'), /\[Omni Chat /);
  assert.match(file('client/src/components/Chat/Footer.tsx'), /github\.com\/GoreeCloud\/omni-chat/);
  // The welcome disclaimer browser regression must follow the branded footer,
  // not assert an obsolete upstream link and falsely fail a healthy page.
  assert.match(
    file('e2e/specs/mock/scenarios/welcome-disclaimer.spec.ts'),
    /a\[href=.*github\.com\/GoreeCloud\/omni-chat/,
  );
  assert.match(
    file('client/src/components/Nav/SettingsTabs/About/About.tsx'),
    /Omni Chat \(LibreChat-derived\) version:/,
  );
});

test('backend and API fallbacks use Omni Chat', () => {
  const files = [
    'api/server/routes/config.js',
    'api/server/controllers/UserController.js',
    'api/server/controllers/TwoFactorController.js',
    'api/server/services/AuthService.js',
    'packages/api/src/auth/passkey.ts',
    'packages/api/src/shared-links/config.ts',
  ];
  for (const name of files) {
    assert.match(file(name), /'Omni Chat'/, name);
  }
  const example = file('.env.example');
  assert.match(example, /^APP_TITLE=Omni Chat$/m);
  assert.match(example, /^HELP_AND_FAQ_URL=\/$/m);
  assert.match(example, /^MONGO_URI=mongodb:\/\/127\.0\.0\.1:27017\/OmniChat$/m);
  assert.match(example, /^OMNI_MONGO_ROOT_USERNAME=$/m);
  assert.match(example, /^OMNI_MONGO_ROOT_PASSWORD=$/m);
  assert.match(example, /^OMNI_POSTGRES_PASSWORD=$/m);
  assert.match(example, /^OMNI_MEILI_MASTER_KEY=$/m);
});

test('development override selects local source and does not use upstream API image', () => {
  const compose = file('compose.omni-chat.yml');
  assert.match(compose, /dockerfile: Dockerfile/);
  assert.match(compose, /APP_TITLE=Omni Chat/);
  assert.doesNotMatch(compose.split('  admin-panel:')[0], /registry\.librechat\.ai/);
  assert.match(compose, /librechat-admin-panel@sha256:[a-f0-9]{64}/);
  assert.match(compose, /librechat-rag-api-dev-lite@sha256:[a-f0-9]{64}/);
  assert.match(compose, /command: .*--auth.*--bind_ip_all/);
  assert.match(compose, /OMNI_MONGO_ROOT_USERNAME/);
  assert.match(compose, /OMNI_MONGO_ROOT_PASSWORD/);
  assert.match(compose, /OMNI_POSTGRES_PASSWORD/);
  assert.match(compose, /OMNI_MEILI_MASTER_KEY/);
  assert.match(compose, /profiles: \[admin\]/);
  assert.match(compose, /ports: !override/);
  assert.match(compose, /127\.0\.0\.1:.*PORT:-3080/);
  assert.ok(compose.includes("'127.0.0.1:${ADMIN_PANEL_PORT:-3000}:3000'"));
  assert.match(compose, /SESSION_COOKIE_SECURE: 'true'/);
  assert.match(compose, /POSTGRES_DB=OmniChatVectors/);
  assert.match(compose, /POSTGRES_USER=omnic/);
  assert.match(file('.github/workflows/omni-chat-validation.yml'), /verify_omni_compose\.mjs/);
  assert.match(file('packages/api/src/telemetry/config.ts'), /DEFAULT_SERVICE_NAME = 'omni-chat'/);
});

test('production Admin cookies default Secure without breaking local development', () => {
  const production = file('deploy-compose.yml');
  const development = file('docker-compose.yml');
  assert.ok(
    production.includes('SESSION_COOKIE_SECURE=${ADMIN_PANEL_SESSION_COOKIE_SECURE:-true}'),
    'production Admin session cookie default must be secure',
  );
  assert.ok(
    development.includes('SESSION_COOKIE_SECURE=${ADMIN_PANEL_SESSION_COOKIE_SECURE:-false}'),
    'the existing local development HTTP default must remain available',
  );
  const example = file('.env.example');
  assert.match(example, /ADMIN_PANEL_SESSION_COOKIE_SECURE=true/);
  assert.match(example, /Use HTTPS in production/);
});
