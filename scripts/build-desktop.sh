#!/usr/bin/env bash
# Builds the ORIVEXY NIGHTS Windows installer (desktop/).
#
#   scripts/build-desktop.sh            # full build → dist-desktop/ORIVEXY-NIGHTS-Setup-x.y.z.exe
#   scripts/build-desktop.sh --resources-only [--keep-host-natives]
#
# Requires: Node 20+, a local PostgreSQL (to build the base configuration),
# python3 + pip (Visual C++ runtime), wine (NSIS on Linux) and
# network access to the npm registry, PyPI and GitHub releases.
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

MSVC_RUNTIME_VERSION="14.44.35112"
BUILD_DB_URL="${BUILD_DATABASE_URL:-postgresql://nightly:nightly@localhost:5432/orivexy_desktop_build}"
BUILD_DB_NAME="${BUILD_DB_URL##*/}"; BUILD_DB_NAME="${BUILD_DB_NAME%%\?*}"
ADMIN_DB_URL="${BUILD_DB_URL%/*}/postgres"

BASE="$WORK/base"
echo "▸ 1/5 Base data (fresh database $BUILD_DB_NAME: migrations + seed, no content)"
rm -rf "$BASE" && mkdir -p "$BASE"
psql "$ADMIN_DB_URL" -qc "DROP DATABASE IF EXISTS \"$BUILD_DB_NAME\"" -c "CREATE DATABASE \"$BUILD_DB_NAME\""
DATABASE_URL="$BUILD_DB_URL" npx prisma migrate deploy >/dev/null
DATABASE_URL="$BUILD_DB_URL" ADMIN_EMAIL="" ADMIN_PASSWORD="" npx prisma db seed >/dev/null
DATABASE_URL="$BUILD_DB_URL" npx tsx scripts/export-base-data.mts > "$BASE/base-data.sql"

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
# Schema (applied by the app on start, like `prisma migrate deploy`) and base configuration.
mkdir -p "$RES/migrations" && cp -r prisma/migrations/2* "$RES/migrations/"
cp "$BASE/base-data.sql" "$RES/"

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

# PostgreSQL for Windows links against the Visual C++ runtime, which is not
# part of a clean Windows install: ship the redistributable DLLs app-locally.
MSVC="$WORK/msvc" && rm -rf "$MSVC" && mkdir -p "$MSVC"
python3 -m pip download --quiet --no-deps --only-binary=:all: --platform win_amd64 --python-version 3.12 \
  -d "$MSVC" "msvc-runtime==$MSVC_RUNTIME_VERSION"
(cd "$MSVC" && python3 -m zipfile -e ./*.whl .)
PG_BIN="$DESK/node_modules/@embedded-postgres/windows-x64/native/bin"
for dll in vcruntime140.dll vcruntime140_1.dll msvcp140.dll msvcp140_1.dll msvcp140_2.dll; do
  cp "$(find "$MSVC" -path "*/Scripts/$dll" | head -1)" "$PG_BIN/"
done
if [ "${NSIS_DOCKER:-0}" = 1 ]; then
  # CI: electron-builder's official image ships the wine needed for NSIS.
  docker run --rm -v "$ROOT:/project" -w /project/desktop -e ELECTRON_CACHE=/project/desktop/.build/electron-cache \
    electronuserland/builder:wine npx electron-builder --win nsis --x64 --publish never
else
  npx electron-builder --win nsis --x64 --publish never
fi
echo "✔ Installer in dist-desktop/"
