#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR=/home/inhwan/apps/pentaworks
ENV_FILE=/home/inhwan/pentaworks-secrets/.env
REPOSITORY_URL=https://github.com/InhwanCho/penta-works-web.git

if [[ ! -d "$APP_DIR/.git" ]]; then
    mkdir -p "$(dirname "$APP_DIR")"
    git clone --branch dev --single-branch "$REPOSITORY_URL" "$APP_DIR"
else
    git -C "$APP_DIR" fetch origin dev
    git -C "$APP_DIR" checkout dev
    git -C "$APP_DIR" merge --ff-only origin/dev
fi

cd "$APP_DIR"

docker compose --env-file "$ENV_FILE" build backend frontend
docker compose --env-file "$ENV_FILE" up -d --remove-orphans

for attempt_no in $(seq 1 30); do
    if curl --fail --silent http://127.0.0.1:8080/actuator/health >/dev/null \
        && curl --fail --silent http://127.0.0.1:3000 >/dev/null; then
        docker compose --env-file "$ENV_FILE" ps
        exit 0
    fi
    sleep 2
done

docker compose --env-file "$ENV_FILE" ps
docker compose --env-file "$ENV_FILE" logs --tail=100 backend frontend
exit 1
