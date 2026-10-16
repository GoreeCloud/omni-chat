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
  assert.match(file('.env.example'), /^APP_TITLE=Omni Chat$/m);
  assert.match(file('.env.example'), /^HELP_AND_FAQ_URL=\/$/m);
});

test('development override selects local source and does not use upstream API image', () => {
  const compose = file('compose.omni-chat.yml');
  assert.match(compose, /dockerfile: Dockerfile/);
  assert.match(compose, /APP_TITLE=Omni Chat/);
  assert.doesNotMatch(compose, /registry\.librechat\.ai/);
  assert.match(compose, /\["mongod", "--auth", "--bind_ip_all"\]/);
  assert.match(compose, /OMNI_MONGO_ROOT_USERNAME/);
  assert.match(compose, /OMNI_MONGO_ROOT_PASSWORD/);
});
