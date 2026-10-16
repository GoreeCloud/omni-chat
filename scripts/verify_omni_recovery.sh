#!/usr/bin/env bash
set -Eeuo pipefail
if [[ "${OMNI_SYNTHETIC_RECOVERY:-}" != "1" ]]; then
  echo 'Synthetic recovery verification must be explicitly enabled' >&2
  exit 2
fi
command -v docker >/dev/null
name="omni-ci-recovery-${GITHUB_RUN_ID:-local}-$$"
mongo="${name}-mongo"
postgres="${name}-postgres"
network="${name}-network"
work="$(mktemp -d)"
cleanup() {
  docker rm -f "$mongo" "$postgres" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
  rm -f "$work/mongo.archive" "$work/postgres.dump"
  rmdir "$work" || true
}
trap cleanup EXIT
docker network create "$network" >/dev/null
docker run -d --name "$mongo" --network "$network" \
  -e MONGO_INITDB_ROOT_USERNAME=omnitest \
  -e MONGO_INITDB_ROOT_PASSWORD=synthetic-mongo-pass \
  mongo:8.0.20 --auth --bind_ip_all >/dev/null
docker run -d --name "$postgres" --network "$network" \
  -e POSTGRES_USER=omnic \
  -e POSTGRES_DB=OmniChatVectors \
  -e POSTGRES_PASSWORD=synthetic-postgres-pass \
  pgvector/pgvector:0.8.0-pg15-trixie >/dev/null
ready=false
for attempt in $(seq 1 90); do
  if docker exec "$mongo" mongosh --quiet -u omnitest \
      -p synthetic-mongo-pass --authenticationDatabase admin \
      --eval 'db.adminCommand({ping:1}).ok' >/dev/null 2>&1 && \
     docker exec "$postgres" pg_isready -U omnic -d OmniChatVectors >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 2
done
[[ "$ready" == true ]] || { echo 'Synthetic database readiness timeout' >&2; exit 1; }

docker exec "$mongo" mongosh --quiet -u omnitest -p synthetic-mongo-pass \
  --authenticationDatabase admin \
  --eval 'db.getSiblingDB("OmniChat").recovery.insertOne({name:"fixture"})' >/dev/null
docker exec "$mongo" mongodump -u omnitest -p synthetic-mongo-pass \
  --authenticationDatabase admin --db OmniChat --archive > "$work/mongo.archive"
test -s "$work/mongo.archive"
docker exec "$mongo" mongosh --quiet -u omnitest -p synthetic-mongo-pass \
  --authenticationDatabase admin \
  --eval 'db.getSiblingDB("OmniChat").dropDatabase()' >/dev/null
docker exec -i "$mongo" mongorestore -u omnitest -p synthetic-mongo-pass \
  --authenticationDatabase admin --archive < "$work/mongo.archive" >/dev/null
count="$(docker exec "$mongo" mongosh --quiet -u omnitest -p synthetic-mongo-pass \
  --authenticationDatabase admin \
  --eval 'db.getSiblingDB("OmniChat").recovery.countDocuments({name:"fixture"})')"
[[ "$count" == "1" ]] || { echo 'Synthetic MongoDB recovery mismatch' >&2; exit 1; }
echo 'MongoDB synthetic backup and recovery: PASS'
docker exec "$postgres" psql -U omnic -d OmniChatVectors -v ON_ERROR_STOP=1 -q \
  -c "CREATE EXTENSION IF NOT EXISTS vector; CREATE TABLE recovery_vectors (id text PRIMARY KEY, embedding vector(3)); INSERT INTO recovery_vectors VALUES ('fixture', '[1,2,3]');"
docker exec "$postgres" pg_dump -Fc -U omnic -d OmniChatVectors > "$work/postgres.dump"
test -s "$work/postgres.dump"
docker exec "$postgres" createdb -U omnic OmniChatRestored
docker exec -i "$postgres" pg_restore --no-owner -U omnic \
  -d OmniChatRestored < "$work/postgres.dump"
count="$(docker exec "$postgres" psql -U omnic -d OmniChatRestored -A -t -q \
  -c "SELECT count(*) FROM recovery_vectors WHERE id='fixture' AND embedding='[1,2,3]'::vector;")"
[[ "$count" == "1" ]] || { echo 'Synthetic pgvector recovery mismatch' >&2; exit 1; }
echo 'PostgreSQL pgvector synthetic backup and recovery: PASS'
