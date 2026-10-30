#!/usr/bin/env bash
# Build app/ and publish it to the gh-pages branch (GitHub Pages).
# Usage: VITE_API_URL=https://your-server ./scripts/deploy-pages.sh
set -euo pipefail
cd "$(dirname "$0")/.."
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
