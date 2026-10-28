#!/bin/bash
# Creates a project-specific MongoDB user with readWrite access.
# Usage: ./mongo-create-user.sh <container> <root-user> <root-pass> <db-name> <app-user> <app-pass>
#
# Example:
#   ./mongo-create-user.sh agata-server-mongo root rootpass webcaptioner webcaptioner_app mySecretPw

set -euo pipefail

CONTAINER="${1:?Usage: $0 <container> <root-user> <root-pass> <db-name> <app-user> <app-pass>}"
ROOT_USER="${2:?}"
ROOT_PASS="${3:?}"
DB_NAME="${4:?}"
APP_USER="${5:?}"
APP_PASS="${6:?}"

docker exec "$CONTAINER" mongosh \
  -u "$ROOT_USER" \
  -p "$ROOT_PASS" \
  --authenticationDatabase admin \
  --eval "
    db = db.getSiblingDB('${DB_NAME}');
    if (db.getUser('${APP_USER}')) {
      print('User ${APP_USER} already exists in ${DB_NAME}, skipping.');
    } else {
      db.createUser({
        user: '${APP_USER}',
        pwd: '${APP_PASS}',
        roles: [{ role: 'readWrite', db: '${DB_NAME}' }]
      });
      print('Created user ${APP_USER} with readWrite on ${DB_NAME}');
    }
  "
