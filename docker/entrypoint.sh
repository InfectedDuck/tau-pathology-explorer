#!/bin/sh
# Production entrypoint: inject runtime config without rebuilding.
# VITE_API_URL baked at build time still applies when this is empty.
set -eu

: "${VITE_API_URL:=}"

cat > /usr/share/nginx/html/env.js <<EOF
window.__APP_ENV__ = {
  VITE_API_URL: "${VITE_API_URL}"
};
EOF

exec nginx -g "daemon off;"
