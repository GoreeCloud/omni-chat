import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const configPath = process.argv[2];
if (!configPath) {
  console.error('Usage: node scripts/verify_omni_compose.mjs <docker-compose-config.json>');
  process.exitCode = 2;
} else {
  const services = JSON.parse(readFileSync(configPath, 'utf8')).services;
  assert.ok(
    services?.api &&
      services.mongodb &&
      services.meilisearch &&
      services.vectordb &&
      services.rag_api,
  );

  // Validate the *effective* Compose model, not just the checked-in YAML.
  // Published ports and host networking on an inherited dependency would
  // bypass the development API's loopback-only boundary.
  const assertInternalIsolation = (model, profile) => {
    for (const name of ['mongodb', 'meilisearch', 'vectordb', 'rag_api']) {
      const service = model[name];
      assert.ok(service, `${profile}: ${name} service must exist`);
      assert.ok(
        !service.ports?.length,
        `${profile}: ${name} must not publish host ports`,
      );
      assert.ok(
        !service.network_mode,
        `${profile}: ${name} must not use network_mode`,
      );
    }
  };
  assertInternalIsolation(services, 'default');
  assert.ok(!services.api.network_mode, 'development API must not use network_mode');

  const apiEnv = services.api.environment;
  const mongoEnv = services.mongodb.environment;
  const meiliEnv = services.meilisearch.environment;
  const postgresEnv = services.vectordb.environment;
  const ragEnv = services.rag_api.environment;
  assert.match(
    services.rag_api.image,
    /^registry\.librechat\.ai\/librechat-ai\/librechat-rag-api-dev-lite@sha256:[a-f0-9]{64}$/,
    'RAG image must be pinned to an immutable digest',
  );

  assert.equal(
    services.api.build?.dockerfile,
    'Dockerfile',
    'API must build from GoreeCloud source',
  );
  assert.equal(apiEnv.APP_TITLE, 'Omni Chat');
  assert.equal(apiEnv.MEILI_MASTER_KEY, meiliEnv.MEILI_MASTER_KEY);
  assert.ok(meiliEnv.MEILI_MASTER_KEY?.length >= 16);
  const apiPorts = services.api.ports;
  assert.equal(apiPorts?.length, 1, 'API must not inherit an extra public port');
  assert.equal(apiPorts[0].host_ip, '127.0.0.1', 'development API must bind to localhost');
  assert.ok(apiPorts[0].target > 0, 'API must keep a valid internal listener');
  assert.equal(
    services['admin-panel'],
    undefined,
    'admin panel must not appear in default Compose services',
  );
  const adminConfigPath = process.argv[3];
  assert.ok(adminConfigPath, 'opt-in admin Compose configuration is required');
  const adminServices = JSON.parse(readFileSync(adminConfigPath, 'utf8')).services;
  assert.ok(adminServices?.['admin-panel'], 'admin profile must activate the admin panel');
  assertInternalIsolation(adminServices, 'admin');
  assert.ok(!adminServices.api?.network_mode, 'admin profile API must not use network_mode');
  assert.equal(adminServices.api?.ports?.length, 1, 'admin profile API must publish one port');
  assert.equal(adminServices.api.ports[0].host_ip, '127.0.0.1', 'admin profile API must bind to localhost');
  assert.ok(
    !adminServices['admin-panel'].network_mode,
    'admin panel must not use network_mode',
  );
  assert.match(
    adminServices['admin-panel'].image,
    /^registry\.librechat\.ai\/clickhouse\/librechat-admin-panel@sha256:[a-f0-9]{64}$/,
    'opt-in admin image must be pinned to an immutable digest',
  );
  const published = adminServices['admin-panel'].ports;
  assert.equal(published?.length, 1, 'admin panel must not inherit an extra public port');
  assert.equal(published[0].host_ip, '127.0.0.1', 'admin port must bind to localhost');
  assert.equal(published[0].target, 3000);
  assert.ok(
    adminServices['admin-panel'].environment.SESSION_SECRET?.length >= 32,
    'opt-in admin profile must have a 32+ character session secret',
  );
  assert.equal(
    adminServices['admin-panel'].environment.SESSION_COOKIE_SECURE,
    'true',
    'admin panel must require secure session cookies by default',
  );
  assert.deepEqual(services.mongodb.command, ['mongod', '--auth', '--bind_ip_all']);
  assert.equal(typeof mongoEnv.MONGO_INITDB_ROOT_USERNAME, 'string');
  assert.ok(mongoEnv.MONGO_INITDB_ROOT_USERNAME.length > 0);
  assert.ok(mongoEnv.MONGO_INITDB_ROOT_PASSWORD?.length > 0);
  assert.equal(apiEnv.MONGO_URI, 'mongodb://mongodb:27017/OmniChat?authSource=admin');
  assert.equal(apiEnv.OMNI_MONGO_ROOT_USERNAME, mongoEnv.MONGO_INITDB_ROOT_USERNAME);
  assert.equal(apiEnv.OMNI_MONGO_ROOT_PASSWORD, mongoEnv.MONGO_INITDB_ROOT_PASSWORD);
  assert.equal(postgresEnv.POSTGRES_DB, 'OmniChatVectors');
  assert.equal(ragEnv.POSTGRES_DB, postgresEnv.POSTGRES_DB);
  assert.equal(ragEnv.POSTGRES_USER, postgresEnv.POSTGRES_USER);
  assert.equal(ragEnv.POSTGRES_PASSWORD, postgresEnv.POSTGRES_PASSWORD);
  assert.ok(
    postgresEnv.POSTGRES_PASSWORD.length >= 12,
    'synthetic test credentials must be nonempty',
  );
  assert.notEqual(
    postgresEnv.POSTGRES_PASSWORD,
    'mypassword',
    'inherited static credential must not survive',
  );

  console.log(
    'Omni Chat source-built development Compose contract verified (no credentials printed)',
  );
}
