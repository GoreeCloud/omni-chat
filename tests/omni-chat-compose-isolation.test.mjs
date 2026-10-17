import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve, join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temp = mkdtempSync(join(tmpdir(), 'omni-compose-isolation-'));
after(() => rmSync(temp, { recursive: true, force: true }));

const secret = 'synthetic_compose_test_value_only_2026';
const searchKey = 'synthetic_search_master_test_key_2026';
const imageDigest = 'a'.repeat(64);

function fixtures() {
  const services = {
    api: {
      build: { dockerfile: 'Dockerfile' },
      ports: [{ host_ip: '127.0.0.1', target: 3080 }],
      environment: {
        APP_TITLE: 'Omni Chat',
        MEILI_MASTER_KEY: searchKey,
        MONGO_URI: 'mongodb://mongodb:27017/OmniChat?authSource=admin',
        OMNI_MONGO_ROOT_USERNAME: 'omnicitest',
        OMNI_MONGO_ROOT_PASSWORD: secret,
      },
    },
    mongodb: {
      command: ['mongod', '--auth', '--bind_ip_all'],
      environment: {
        MONGO_INITDB_ROOT_USERNAME: 'omnicitest',
        MONGO_INITDB_ROOT_PASSWORD: secret,
      },
    },
    meilisearch: { environment: { MEILI_MASTER_KEY: searchKey } },
    vectordb: {
      environment: {
        POSTGRES_DB: 'OmniChatVectors',
        POSTGRES_USER: 'omnic',
        POSTGRES_PASSWORD: secret,
      },
    },
    rag_api: {
      image:
        'registry.librechat.ai/librechat-ai/librechat-rag-api-dev-lite@sha256:' +
        imageDigest,
      environment: {
        POSTGRES_DB: 'OmniChatVectors',
        POSTGRES_USER: 'omnic',
        POSTGRES_PASSWORD: secret,
      },
    },
  };
  const adminServices = structuredClone(services);
  adminServices['admin-panel'] = {
    image:
      'registry.librechat.ai/clickhouse/librechat-admin-panel@sha256:' +
      imageDigest,
    ports: [{ host_ip: '127.0.0.1', target: 3000 }],
    environment: {
      SESSION_SECRET: secret,
      SESSION_COOKIE_SECURE: 'true',
    },
  };
  return {
    defaults: { services },
    admin: { services: adminServices },
  };
}

function verify(mutate = () => {}) {
  const models = fixtures();
  mutate(models);
  const defaultPath = join(temp, 'default.json');
  const adminPath = join(temp, 'admin.json');
  writeFileSync(defaultPath, JSON.stringify(models.defaults));
  writeFileSync(adminPath, JSON.stringify(models.admin));
  return spawnSync(
    process.execPath,
    ['scripts/verify_omni_compose.mjs', defaultPath, adminPath],
    { cwd: root, encoding: 'utf8' },
  );
}

test('synthetic isolated Compose models satisfy the effective configuration contract', () => {
  const result = verify();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Compose contract verified/);
});

for (const profile of ['defaults', 'admin']) {
  for (const service of ['mongodb', 'meilisearch', 'vectordb', 'rag_api']) {
    test(profile + ' rejects host-published port on ' + service, () => {
      const result = verify((models) => {
        models[profile].services[service].ports = [
          { host_ip: '0.0.0.0', published: '27017', target: 27017 },
        ];
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, new RegExp(service + ' must not publish host ports'));
    });

    test(profile + ' rejects host networking on ' + service, () => {
      const result = verify((models) => {
        models[profile].services[service].network_mode = 'host';
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, new RegExp(service + ' must not use network_mode'));
    });
  }
}

for (const profile of ['defaults', 'admin']) {
  test(profile + ' rejects API host networking', () => {
    const result = verify((models) => {
      models[profile].services.api.network_mode = 'host';
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /API must not use network_mode/);
  });
}

test('admin profile rejects a publicly bound API', () => {
  const result = verify((models) => {
    models.admin.services.api.ports[0].host_ip = '0.0.0.0';
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /admin profile API must bind to localhost/);
});

test('admin profile rejects admin-panel host networking', () => {
  const result = verify((models) => {
    models.admin.services['admin-panel'].network_mode = 'host';
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /admin panel must not use network_mode/);
});
