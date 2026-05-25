#!/bin/bash
# Deploy Ads Dashboard to VPS
# Usage: bash deploy.sh

VPS_IP="103.241.43.88"
VPS_USER="root"
REMOTE_DIR="/var/www/ads-dashboard"
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"

SSH="ssh -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=6"
SCP="scp -o ConnectTimeout=20 -o ServerAliveInterval=15"

echo "=== Ads Dashboard Deploy ==="
echo "Target: $VPS_USER@$VPS_IP:$REMOTE_DIR"
echo ""

# Build frontend
echo "[1/4] Building frontend..."
cd "$LOCAL_DIR/frontend" && npm run build
if [ $? -ne 0 ]; then echo "Frontend build failed!"; exit 1; fi
echo "Frontend built OK"

# Bundle everything into one tar
echo "[2/4] Bundling files..."
BUNDLE="/tmp/ads-deploy-bundle.tar.gz"
cd "$LOCAL_DIR"
tar czf "$BUNDLE" \
  --exclude='backend/node_modules' \
  --exclude='backend/data' \
  --exclude='backend/.env' \
  backend/routes \
  backend/server.js \
  backend/cache.js \
  backend/package.json \
  backend/ecosystem.config.cjs \
  frontend/dist
echo "Bundle created: $(du -sh $BUNDLE | cut -f1)"

# Upload bundle
echo "[3/4] Uploading bundle..."
$SCP "$BUNDLE" "$VPS_USER@$VPS_IP:/tmp/ads-deploy-bundle.tar.gz"
if [ $? -ne 0 ]; then echo "Upload failed!"; exit 1; fi

# Extract and restart in one SSH session
echo "[4/4] Deploying on VPS..."
$SSH $VPS_USER@$VPS_IP "
  set -e
  mkdir -p $REMOTE_DIR/backend/routes $REMOTE_DIR/backend/data $REMOTE_DIR/frontend

  # Extract bundle
  tar xzf /tmp/ads-deploy-bundle.tar.gz -C $REMOTE_DIR
  rm /tmp/ads-deploy-bundle.tar.gz

  # Preserve .env
  [ -f $REMOTE_DIR/backend/.env ] || echo 'WARNING: No .env on server!'

  cd $REMOTE_DIR/backend
  npm install --production --silent

  which pm2 || npm install -g pm2

  pm2 describe ads-backend > /dev/null 2>&1 \
    && pm2 restart ads-backend --update-env \
    || PORT=3002 pm2 start server.js --name ads-backend --env production

  pm2 save
  echo 'Deploy OK'
"

rm -f "$BUNDLE"

echo ""
echo "=== Deploy complete ==="
echo "Dashboard: http://$VPS_IP (port 80 via Caddy → 3002)"
echo "Login: admin / admin123"
