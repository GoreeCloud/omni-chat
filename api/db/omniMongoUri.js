/**
 * Construct a development MongoDB URI without treating arbitrary password
 * punctuation as URI syntax. Leave legacy MONGO_URI consumers unchanged.
 */
function resolveMongoUri(env) {
  const uri = env.MONGO_URI;
  if (!uri) {
    throw new Error('Please define the MONGO_URI environment variable');
  }

  const username = env.OMNI_MONGO_ROOT_USERNAME;
  const password = env.OMNI_MONGO_ROOT_PASSWORD;
  // The checked-in .env.example leaves both Omni variables blank, so
  // standalone (non-Compose) development must retain normal MONGO_URI behavior.
  if ((username === undefined || username === '') && (password === undefined || password === '')) {
    return uri;
  }
  if (typeof username !== 'string' || !username || typeof password !== 'string' || !password) {
    throw new Error('Omni Chat MongoDB username and password must both be nonempty');
  }

  let parsed;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error('Invalid Omni Chat MongoDB base URI');
  }
  if (
    parsed.protocol !== 'mongodb:' ||
    parsed.hostname !== 'mongodb' ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== '/OmniChat' ||
    parsed.searchParams.get('authSource') !== 'admin'
  ) {
    throw new Error(
      'Omni Chat credentials require the expected uncredentialed development MongoDB URI',
    );
  }

  // WHATWG URL setters do not encode literal '%' reliably. Encode first
  // so each credential round-trips even when it contains %, @, ?, or #.
  parsed.username = encodeURIComponent(username);
  parsed.password = encodeURIComponent(password);
  return parsed.toString();
}

module.exports = { resolveMongoUri };
