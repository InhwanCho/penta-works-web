#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DOMAIN=pentaworks.net
APP_DOMAIN=app.pentaworks.net
APP_DIR=/home/inhwan/apps/pentaworks-prod
CLOUDFLARE_CREDENTIALS=/etc/letsencrypt/secrets/cloudflare.ini

if [[ $EUID -ne 0 ]]; then
    echo "Run this script with sudo." >&2
    exit 1
fi

if [[ ! -r "$CLOUDFLARE_CREDENTIALS" ]]; then
    echo "Missing Cloudflare credentials: $CLOUDFLARE_CREDENTIALS" >&2
    exit 1
fi

for domain in "$ROOT_DOMAIN" "$APP_DOMAIN"; do
    if [[ ! -f "$APP_DIR/deploy/nginx/$domain.conf" ]]; then
        echo "Missing Nginx config: $APP_DIR/deploy/nginx/$domain.conf" >&2
        exit 1
    fi

    certbot certonly \
        --non-interactive \
        --dns-cloudflare \
        --dns-cloudflare-credentials "$CLOUDFLARE_CREDENTIALS" \
        --dns-cloudflare-propagation-seconds 60 \
        --cert-name "$domain" \
        -d "$domain"

    install -m 644 "$APP_DIR/deploy/nginx/$domain.conf" "/etc/nginx/sites-available/$domain"
    ln -sfn "/etc/nginx/sites-available/$domain" "/etc/nginx/sites-enabled/$domain"
done

nginx -t
systemctl reload nginx

curl --fail --silent --show-error \
    --retry 5 \
    --retry-all-errors \
    --retry-delay 1 \
    --resolve "$APP_DOMAIN:443:127.0.0.1" \
    "https://$APP_DOMAIN/" >/dev/null

echo "Production origin is ready at https://$APP_DOMAIN"
