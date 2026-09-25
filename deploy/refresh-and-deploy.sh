#!/usr/bin/env bash
set -Eeuo pipefail

REPOSITORY_URL=https://github.com/InhwanCho/penta-works-web.git

DEPLOY_ENV=${1:-}

case "$DEPLOY_ENV" in
    dev)
        APP_DIR=/home/inhwan/apps/pentaworks
        ENV_FILE=/home/inhwan/pentaworks-secrets/.env
        BRANCH=dev
        COMPOSE_FILE=docker-compose.yml
        COMPOSE_PROJECT=pentaworks
        DEFAULT_FRONTEND_PORT=3000
        DEFAULT_BACKEND_PORT=8080
        ;;
    prod)
        APP_DIR=/home/inhwan/apps/pentaworks-prod
        ENV_FILE=/home/inhwan/pentaworks-secrets/prod.env
        BRANCH=main
        COMPOSE_FILE=docker-compose.prod.yml
        COMPOSE_PROJECT=pentaworks-prod
        DEFAULT_FRONTEND_PORT=3100
        DEFAULT_BACKEND_PORT=8180
        ;;
    *)
        echo "Usage: $0 <dev|prod>" >&2
        exit 2
        ;;
esac

if [[ ! -f "$ENV_FILE" ]]; then
    echo "Missing deployment environment file: $ENV_FILE" >&2
    exit 1
fi

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

FRONTEND_PORT=${FRONTEND_PORT:-$DEFAULT_FRONTEND_PORT}
BACKEND_PORT=${BACKEND_PORT:-$DEFAULT_BACKEND_PORT}

if [[ ! -d "$APP_DIR/.git" ]]; then
    mkdir -p "$(dirname "$APP_DIR")"
    git clone --branch "$BRANCH" --single-branch "$REPOSITORY_URL" "$APP_DIR"
else
    if ! git -C "$APP_DIR" diff --quiet \
        || ! git -C "$APP_DIR" diff --cached --quiet \
        || [[ -n "$(git -C "$APP_DIR" ls-files --others --exclude-standard)" ]]; then
        git -C "$APP_DIR" stash push --include-untracked \
            --message "jenkins-predeploy-$(date +%Y%m%d-%H%M%S)"
    fi
    git -C "$APP_DIR" fetch origin "$BRANCH"
    git -C "$APP_DIR" checkout "$BRANCH"
    git -C "$APP_DIR" merge --ff-only "origin/$BRANCH"
fi

cd "$APP_DIR"

if [[ ! -f "$COMPOSE_FILE" ]]; then
    echo "Missing Compose file: $APP_DIR/$COMPOSE_FILE" >&2
    exit 1
fi

if ! docker network inspect pentaworks-integration >/dev/null 2>&1; then
    docker network create pentaworks-integration >/dev/null
fi

if [[ "$DEPLOY_ENV" == "prod" ]] && ! docker network inspect pentaworks_default >/dev/null 2>&1; then
    echo "Shared database network pentaworks_default does not exist" >&2
    exit 1
fi

if [[ "$DEPLOY_ENV" == "prod" ]] && ! docker network inspect pentaworks_default \
    --format '{{json .Containers}}' | grep -q 'pentaworks-mri-db'; then
    echo "Shared database container pentaworks-mri-db is not attached to pentaworks_default" >&2
    exit 1
fi

compose=(docker compose --project-name "$COMPOSE_PROJECT" --env-file "$ENV_FILE" -f "$COMPOSE_FILE")

"${compose[@]}" build backend frontend
"${compose[@]}" up -d --remove-orphans

for attempt_no in $(seq 1 30); do
    if curl --fail --silent "http://127.0.0.1:${BACKEND_PORT}/actuator/health" >/dev/null \
        && curl --fail --silent "http://127.0.0.1:${FRONTEND_PORT}" >/dev/null; then
        docker run --rm \
            --network pentaworks-integration \
            --env OFFICE_API_KEY \
            --entrypoint sh \
            curlimages/curl:8.12.1 \
            -c 'curl --fail --silent --show-error \
                --header "X-MREyes-Api-Key: ${OFFICE_API_KEY}" \
                "http://office-backend:8080/api/v1/integrations/mreyes/sites/006"' \
            >/dev/null
        "${compose[@]}" ps
        exit 0
    fi
    sleep 2
done

"${compose[@]}" ps
"${compose[@]}" logs --tail=100 backend frontend
exit 1
