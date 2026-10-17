import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../scripts/omni-chat-upstream-divergence.sh',
);

test('upstream comparison distinguishes branded fork commits from upstream changes', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'omni-chat-git-status-'));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  const compare = () =>
    execFileSync('bash', [script, 'main', 'upstream'], { cwd, encoding: 'utf8' });
  try {
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'ci@example.invalid');
    git('config', 'user.name', 'CI fixture');
    git('commit', '--allow-empty', '-qm', 'shared base');
    git('branch', 'upstream');

    let result = compare();
    assert.match(result, /Upstream-only commits: 0/);
    assert.match(result, /Fork-only commits: 0/);

    git('commit', '--allow-empty', '-qm', 'GoreeCloud branding');
    result = compare();
    assert.match(result, /Upstream-only commits: 0/);
    assert.match(result, /Fork-only commits: 1/);
    assert.match(result, /no commits outside fork ancestry/);

    git('checkout', '-q', 'upstream');
    git('commit', '--allow-empty', '-qm', 'upstream new fix');
    result = compare();
    assert.match(result, /Upstream-only commits: 1/);
    assert.match(result, /Fork-only commits: 1/);
    assert.match(result, /requiring selective review/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
