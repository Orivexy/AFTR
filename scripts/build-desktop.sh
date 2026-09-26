#!/usr/bin/env bash
# Builds the NIVEX Windows installer (desktop/).
#
#   scripts/build-desktop.sh            # full build → dist-desktop/NIVEX-Setup-x.y.z.exe
#   scripts/build-desktop.sh --resources-only [--keep-host-natives]
#
# Requires: Node 20+, a local PostgreSQL (for generating the demo data) with
# pg_dump 16, and network access to the npm registry and GitHub releases.
set -euo pipefail
cd "$(dirname "$0")/.."

ROOT="$PWD"
DESK="$ROOT/desktop"
RES="$DESK/resources"
WORK="$DESK/.build"
RESOURCES_ONLY=false
KEEP_HOST=false
for arg in "$@"; do
  case "$arg" in
    --resources-only) RESOURCES_ONLY=true ;;
    --keep-host-natives) KEEP_HOST=true ;;
  esac
done

BUILD_DB_URL="${BUILD_DATABASE_URL:-postgresql://nightly:nightly@localhost:5432/nivex_desktop_build}"
BUILD_DB_NAME="${BUILD_DB_URL##*/}"; BUILD_DB_NAME="${BUILD_DB_NAME%%\?*}"
ADMIN_DB_URL="${BUILD_DB_URL%/*}/postgres"

DEMO="$WORK/demo"
if [ "${REUSE_DEMO:-0}" = 1 ] && [ -f "$DEMO/demo.sql" ]; then
  echo "▸ 1/5 Demo data (reusing $DEMO)"
else
  echo "▸ 1/5 Demo data (fresh seed in $BUILD_DB_NAME)"
  rm -rf "$DEMO" && mkdir -p "$DEMO/storage"
  psql "$ADMIN_DB_URL" -qc "DROP DATABASE IF EXISTS \"$BUILD_DB_NAME\"" -c "CREATE DATABASE \"$BUILD_DB_NAME\""
  DATABASE_URL="$BUILD_DB_URL" npx prisma migrate deploy >/dev/null
  DATABASE_URL="$BUILD_DB_URL" STORAGE_LOCAL_DIR="$DEMO/storage" npx prisma db seed
  pg_dump "$BUILD_DB_URL" --no-owner --no-privileges --no-comments --inserts --rows-per-insert=250 --file "$DEMO/demo.sql"
  node -e "require('fs').writeFileSync(process.argv[1], JSON.stringify({ dumpedAt: new Date().toISOString() }))" "$DEMO/demo-meta.json"
fi

echo "▸ 2/5 Next.js standalone server"
rm -rf .next
NEXT_OUTPUT=standalone APP_URL="http://localhost:3000" NEXT_TELEMETRY_DISABLED=1 npx next build >/dev/null

echo "▸ 3/5 Assembling resources"
rm -rf "$RES" && mkdir -p "$RES/bin"
cp -r .next/standalone "$RES/server"
mkdir -p "$RES/server/.next" && cp -r .next/static "$RES/server/.next/static"
cp -r public "$RES/server/public"
rm -f "$RES/server/.env" # never ship local secrets
rm -rf "$RES/server/src" "$RES/server/prisma" "$RES/server/tests" "$RES/server/desktop" # traced by accident, not needed at runtime
cp -r "$DEMO/storage" "$RES/storage"
cp "$DEMO/demo.sql" "$DEMO/demo-meta.json" "$RES/"

echo "▸ 4/5 Windows native binaries"
PACKS="$WORK/packs" && rm -rf "$PACKS" && mkdir -p "$PACKS"
pkg_version() { node -p "JSON.parse(require('fs').readFileSync('$1/package.json','utf8')).version"; }
fetch_pkg() { # name@version → extracted dir
  (cd "$PACKS" && npm pack "$1" --silent >/dev/null)
  local tgz; tgz=$(ls -t "$PACKS"/*.tgz | head -1)
  local out="$PACKS/$(basename "$tgz" .tgz)"; mkdir -p "$out"
  tar -xzf "$tgz" -C "$out" --strip-components=1 && rm "$tgz"
  echo "$out"
}
SHARP_VERSION=$(pkg_version node_modules/sharp)
SHARP_WIN=$(fetch_pkg "@img/sharp-win32-x64@$SHARP_VERSION")
mkdir -p "$RES/server/node_modules/@img" && rm -rf "$RES/server/node_modules/@img/sharp-win32-x64" && cp -r "$SHARP_WIN" "$RES/server/node_modules/@img/sharp-win32-x64"
mkdir -p "$RES/server/node_modules/.prisma/client"
cp node_modules/.prisma/client/query_engine-windows.dll.node "$RES/server/node_modules/.prisma/client/"
FF=$(fetch_pkg "@ffmpeg-installer/win32-x64") && cp "$FF/ffmpeg.exe" "$RES/bin/"
FP=$(fetch_pkg "@ffprobe-installer/win32-x64") && cp "$FP/ffprobe.exe" "$RES/bin/"

if [ "$KEEP_HOST" = false ]; then
  # Drop host (Linux) natives from the Windows bundle.
  rm -rf "$RES/server/node_modules/@img/sharp-linux"* "$RES/server/node_modules/@img/sharp-libvips-linux"* \
         "$RES/server/node_modules/@ffmpeg-installer" "$RES/server/node_modules/@ffprobe-installer"
  find "$RES/server/node_modules" -name "*.so.node" -delete
else
  cp "$(node -p "require('@ffmpeg-installer/ffmpeg').path")" "$RES/bin/ffmpeg"
  cp "$(node -p "require('@ffprobe-installer/ffprobe').path")" "$RES/bin/ffprobe"
fi
du -sh "$RES"/* | sed 's/^/   /'

[ "$RESOURCES_ONLY" = true ] && { echo "✔ Resources ready in desktop/resources"; exit 0; }

echo "▸ 5/5 Windows installer"
cd "$DESK"
npm install --no-audit --no-fund >/dev/null
npm install --no-save --force --no-audit --no-fund "@embedded-postgres/windows-x64@$(pkg_version node_modules/embedded-postgres)" >/dev/null
npx electron-builder --win nsis --x64 --publish never
echo "✔ Installer in dist-desktop/"
