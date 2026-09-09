#!/usr/bin/env bash
set -Eeuo pipefail

DOMAIN=pentaworks.net
APP_DIR=/home/inhwan/apps/pentaworks-prod
CLOUDFLARE_CREDENTIALS=/etc/letsencrypt/secrets/cloudflare.ini
NGINX_AVAILABLE=/etc/nginx/sites-available/$DOMAIN
NGINX_ENABLED=/etc/nginx/sites-enabled/$DOMAIN

if [[ $EUID -ne 0 ]]; then
    echo "Run this script with sudo." >&2
    exit 1
fi

if [[ ! -r "$CLOUDFLARE_CREDENTIALS" ]]; then
    echo "Missing Cloudflare credentials: $CLOUDFLARE_CREDENTIALS" >&2
    exit 1
fi

if [[ ! -f "$APP_DIR/deploy/nginx/$DOMAIN.conf" ]]; then
    echo "Missing Nginx config: $APP_DIR/deploy/nginx/$DOMAIN.conf" >&2
    exit 1
fi

certbot certonly \
    --non-interactive \
    --dns-cloudflare \
    --dns-cloudflare-credentials "$CLOUDFLARE_CREDENTIALS" \
    --dns-cloudflare-propagation-seconds 60 \
    --cert-name "$DOMAIN" \
    -d "$DOMAIN"

install -m 644 "$APP_DIR/deploy/nginx/$DOMAIN.conf" "$NGINX_AVAILABLE"
ln -sfn "$NGINX_AVAILABLE" "$NGINX_ENABLED"

nginx -t
systemctl reload nginx

curl --fail --silent --show-error \
    --resolve "$DOMAIN:443:127.0.0.1" \
    "https://$DOMAIN/" >/dev/null

echo "Production origin is ready at https://$DOMAIN"
