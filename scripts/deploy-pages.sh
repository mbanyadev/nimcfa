#!/usr/bin/env bash
# Build app/ and publish it to the gh-pages branch (GitHub Pages).
# Usage: ./scripts/deploy-pages.sh                                   hosted demo (engine runs in the browser, testnet)
#        VITE_API_URL=https://your-server ./scripts/deploy-pages.sh  production (app talks to server/)
set -euo pipefail
cd "$(dirname "$0")/.."
# The demo engine is bundled from server/src, so the server's dependencies are needed for the build too.
(cd server && npm ci --no-audit --no-fund)
(cd app && npm ci --no-audit --no-fund && npm run build)
tmp=$(mktemp -d)
cp -r app/dist/. "$tmp"
touch "$tmp/.nojekyll"
cd "$tmp"
git init -q -b gh-pages
git add -A
git -c user.name="Mbanya Dev" -c user.email="347824690+mbanyadev@users.noreply.github.com" commit -q -m "Deploy app"
git push -f "$(cd - >/dev/null && git remote get-url origin)" gh-pages
rm -rf "$tmp"
