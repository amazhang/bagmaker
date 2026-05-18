#!/usr/bin/env bash
# Recover totes from the 2015-era MongoDB data files in ./data and push them
# to your modern MongoDB (Atlas or local).
#
# Why this is a script and not just `mongorestore`:
#   The files in ./data use the old MMAPv1 storage engine, which was removed
#   in MongoDB 4.2. We need to launch a Mongo 3.6 container (the last version
#   that supports MMAPv1) just to read those files, dump them to JSON, then
#   push the JSON into your modern database.
#
# Prerequisites:
#   - Docker installed and running
#   - mongosh installed locally (brew install mongosh)
#   - .env file with MONGODB_URI set to your target (Atlas) connection string
#
# Usage:
#   ./scripts/restore-old-data.sh
#
# This script is idempotent: it won't duplicate totes if you run it twice
# (it checks for existing _ids before inserting).

set -euo pipefail

# Move to repo root so relative paths work no matter where the script is invoked.
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
    echo "[!] No .env file found. Copy .env.example to .env and set MONGODB_URI first."
    exit 1
fi

# Load MONGODB_URI from .env
set -o allexport; source .env; set +o allexport

if [[ -z "${MONGODB_URI:-}" ]]; then
    echo "[!] MONGODB_URI not set in .env"
    exit 1
fi

if [[ ! -d ./data ]]; then
    echo "[!] No ./data directory found. Nothing to migrate."
    exit 1
fi

DUMP_DIR="./.migration-dump"
mkdir -p "$DUMP_DIR"

echo "[1/3] Starting Mongo 3.6 container against ./data (MMAPv1)..."
CONTAINER_ID=$(docker run -d --rm \
    -v "$(pwd)/data:/data/db" \
    -v "$(pwd)/$DUMP_DIR:/dump" \
    mongo:3.6 \
    mongod --storageEngine=mmapv1 --bind_ip 127.0.0.1 --dbpath /data/db)

# Wait for it to be ready.
echo "    Waiting for mongod to be ready..."
for i in {1..30}; do
    if docker exec "$CONTAINER_ID" mongo --quiet --eval 'db.runCommand({ ping: 1 })' >/dev/null 2>&1; then
        break
    fi
    sleep 1
done

echo "[2/3] Listing databases and dumping totebags..."
docker exec "$CONTAINER_ID" mongo --quiet --eval 'db.adminCommand("listDatabases").databases.forEach(d => print(d.name))'

# Dump every non-system DB. The original app used 'bagmaker' but older builds
# used 'totebags', so we dump both if present.
for DB in bagmaker totebags; do
    if docker exec "$CONTAINER_ID" mongo --quiet --eval "db.getMongo().getDBNames().indexOf('$DB') >= 0 ? 'yes' : 'no'" | grep -q yes; then
        echo "    Dumping database: $DB"
        docker exec "$CONTAINER_ID" mongodump --db "$DB" --out /dump
    fi
done

echo "[3/3] Stopping recovery container..."
docker stop "$CONTAINER_ID" >/dev/null

# Now restore into the modern target.
echo
echo "[+] Dump complete. Files saved to: $DUMP_DIR"
echo "[+] Pushing to MONGODB_URI..."
echo
echo "    If you have mongorestore installed (it ships with MongoDB Database Tools,"
echo "    'brew install mongodb-database-tools'), this will run it now. Otherwise"
echo "    you can run it yourself with:"
echo
echo "      mongorestore --uri=\"\$MONGODB_URI\" --nsFrom='bagmaker.*' --nsTo='bagmaker.*' $DUMP_DIR/bagmaker"
echo

if command -v mongorestore >/dev/null 2>&1; then
    for DB in bagmaker totebags; do
        if [[ -d "$DUMP_DIR/$DB" ]]; then
            echo "    Restoring $DB -> target database 'bagmaker'..."
            mongorestore --uri="$MONGODB_URI" \
                --nsFrom="$DB.*" --nsTo="bagmaker.*" \
                --drop=false \
                "$DUMP_DIR/$DB"
        fi
    done
    echo
    echo "[✓] Migration complete. Inspect your collection via Atlas Data Explorer."
else
    echo "[!] mongorestore not found in PATH. Install with: brew install mongodb-database-tools"
    echo "    Then run the command above to push $DUMP_DIR into Atlas."
fi
