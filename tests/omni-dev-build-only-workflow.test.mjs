import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(
  new URL('../.github/workflows/dev-branch-images.yml', import.meta.url),
  'utf8',
);

test('development image qualification does not publish or use registry credentials', () => {
  assert.match(workflow, /name: Docker Dev Branch Images Build-Only/);
  assert.match(workflow, /pull_request:\n    branches: \[dev\]/);
  assert.match(workflow, /arch: \[amd64, arm64\]/);
  assert.match(workflow, /push: false/);
  assert.match(workflow, /load: true/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /node --test tests\/omni-dev-build-only-workflow\.test\.mjs/);
  for (const forbidden of [
    /docker-publish\.yml/,
    /DOCKERHUB_/,
    /packages: write/,
    /docker\/login-action/,
    /push: true/,
    /secrets:/,
  ]) {
    assert.doesNotMatch(workflow, forbidden);
  }
});
