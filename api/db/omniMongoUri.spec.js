const { MongoClient } = require('mongodb');
const { resolveMongoUri } = require('./omniMongoUri');

const base = 'mongodb://mongodb:27017/OmniChat?authSource=admin';

describe('Omni Chat MongoDB development credentials', () => {
  test('preserves ordinary MONGO_URI consumers without Omni variables', () => {
    const uri = 'mongodb://example.org:27017/Legacy';
    expect(resolveMongoUri({ MONGO_URI: uri })).toBe(uri);
  });

  test('ignores both blank Omni placeholders during standalone development', () => {
    const uri = 'mongodb://127.0.0.1:27017/Legacy';
    expect(
      resolveMongoUri({
        MONGO_URI: uri,
        OMNI_MONGO_ROOT_USERNAME: '',
        OMNI_MONGO_ROOT_PASSWORD: '',
      }),
    ).toBe(uri);
  });

  test('encodes reserved username and password characters without changing Mongo options', () => {
    const username = 'dev+qa@host';
    const password = 'S!afe%pass:@/?# &';
    const uri = resolveMongoUri({
      MONGO_URI: base,
      OMNI_MONGO_ROOT_USERNAME: username,
      OMNI_MONGO_ROOT_PASSWORD: password,
    });
    const parsed = new URL(uri);
    expect(parsed.hostname).toBe('mongodb');
    expect(parsed.pathname).toBe('/OmniChat');
    expect(parsed.searchParams.get('authSource')).toBe('admin');
    expect(decodeURIComponent(parsed.username)).toBe(username);
    expect(decodeURIComponent(parsed.password)).toBe(password);
    expect(uri).not.toContain(password);
    expect(uri).not.toContain(username);
    // Exercise the actual MongoDB driver credential parser, without connecting.
    const client = new MongoClient(uri);
    expect(client.options.credentials.username).toBe(username);
    expect(client.options.credentials.password).toBe(password);
  });

  test.each([
    { MONGO_URI: base, OMNI_MONGO_ROOT_USERNAME: 'user' },
    { MONGO_URI: base, OMNI_MONGO_ROOT_PASSWORD: 'password' },
    { MONGO_URI: base, OMNI_MONGO_ROOT_USERNAME: '', OMNI_MONGO_ROOT_PASSWORD: 'password' },
    { MONGO_URI: base, OMNI_MONGO_ROOT_USERNAME: 'user', OMNI_MONGO_ROOT_PASSWORD: '' },
  ])('rejects incomplete credentials without exposing them', (env) => {
    expect(() => resolveMongoUri(env)).toThrow(/username and password must both be nonempty/);
  });

  test.each([
    'mongodb://example.com:27017/OmniChat?authSource=admin',
    'mongodb://someone:legacy@mongodb:27017/OmniChat?authSource=admin',
    'mongodb://mongodb:27017/Other?authSource=admin',
    'mongodb://mongodb:27017/OmniChat?authSource=other',
  ])('rejects unexpected credential targets', (uri) => {
    expect(() =>
      resolveMongoUri({
        MONGO_URI: uri,
        OMNI_MONGO_ROOT_USERNAME: 'user',
        OMNI_MONGO_ROOT_PASSWORD: 'secret',
      }),
    ).toThrow(/expected uncredentialed development MongoDB URI/);
  });

  test('requires a defined base URI', () => {
    expect(() => resolveMongoUri({})).toThrow(/MONGO_URI/);
  });
});
