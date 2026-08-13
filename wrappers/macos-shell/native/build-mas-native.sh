#!/usr/bin/env bash
set -euo pipefail
export COPYFILE_DISABLE=1
export COPY_EXTENDED_ATTRIBUTES_DISABLE=1

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NATIVE_DIR="$ROOT_DIR/native"
DIST_DIR="$ROOT_DIR/dist/mas-universal"
BUILD_DIR="$ROOT_DIR/dist/native-mas-build-$(date +%Y%m%d%H%M%S)"
APP_PATH="$BUILD_DIR/EducationRev.app"
CLEAN_APP_PATH="$BUILD_DIR/clean/EducationRev.app"
DIST_APP_PATH="$DIST_DIR/EducationRev.app"
PKG_PATH="$DIST_DIR/EducationRev-1.1.1-universal.pkg"
UNSIGNED_PKG_PATH="$BUILD_DIR/EducationRev-1.1.1-universal-unsigned.pkg"
STAGE_ROOT="$BUILD_DIR/package-root"
APP_IDENTITY="Apple Distribution: Nemean Partners Pty Ltd. (7ZU4NQ9RVT)"
INSTALLER_IDENTITY="3rd Party Mac Developer Installer: Nemean Partners Pty Ltd. (7ZU4NQ9RVT)"

strip_metadata() {
  local target="$1"
  /usr/bin/xattr -cr "$target" 2>/dev/null || true
  /usr/bin/xattr -dr com.apple.quarantine "$target" 2>/dev/null || true
  /usr/bin/xattr -dr com.apple.provenance "$target" 2>/dev/null || true
  /usr/bin/find "$target" -name '._*' -delete
}

mkdir -p "$DIST_DIR" "$BUILD_DIR"
mkdir -p "$APP_PATH/Contents/MacOS" "$APP_PATH/Contents/Resources"

cp "$NATIVE_DIR/Info.plist" "$APP_PATH/Contents/Info.plist"
cp "$ROOT_DIR/build/icon.icns" "$APP_PATH/Contents/Resources/icon.icns"
cp "$ROOT_DIR/build/EduRev.provisionprofile" "$APP_PATH/Contents/embedded.provisionprofile"
strip_metadata "$APP_PATH"

xcrun swiftc \
  -target x86_64-apple-macos12.0 \
  -O \
  -framework AppKit \
  -framework WebKit \
  "$NATIVE_DIR/EducationRevApp.swift" \
  -o "$BUILD_DIR/EducationRev-x86_64"

xcrun swiftc \
  -target arm64-apple-macos12.0 \
  -O \
  -framework AppKit \
  -framework WebKit \
  "$NATIVE_DIR/EducationRevApp.swift" \
  -o "$BUILD_DIR/EducationRev-arm64"

xcrun lipo -create \
  "$BUILD_DIR/EducationRev-x86_64" \
  "$BUILD_DIR/EducationRev-arm64" \
  -output "$APP_PATH/Contents/MacOS/EducationRev"

chmod 755 "$APP_PATH/Contents/MacOS/EducationRev"
strip_metadata "$APP_PATH"

/usr/bin/codesign \
  --force \
  --options runtime \
  --timestamp \
  --entitlements "$NATIVE_DIR/entitlements.mas.plist" \
  --sign "$APP_IDENTITY" \
  "$APP_PATH"

strip_metadata "$APP_PATH"

mkdir -p "$(dirname "$CLEAN_APP_PATH")"
/usr/bin/ditto --norsrc --noextattr "$APP_PATH" "$CLEAN_APP_PATH"
strip_metadata "$CLEAN_APP_PATH"
/usr/bin/codesign --verify --deep --strict --verbose=2 "$CLEAN_APP_PATH"

mkdir -p "$STAGE_ROOT/Applications"
/usr/bin/ditto --norsrc --noextattr "$CLEAN_APP_PATH" "$STAGE_ROOT/Applications/EducationRev.app"
strip_metadata "$STAGE_ROOT/Applications/EducationRev.app"

/usr/bin/pkgbuild \
  --root "$STAGE_ROOT" \
  --identifier "ai.edurevolution.wrapper.ios" \
  --version "1.1.1" \
  --install-location "/" \
  --sign "$INSTALLER_IDENTITY" \
  "$PKG_PATH"

if /usr/sbin/pkgutil --payload-files "$PKG_PATH" | /usr/bin/grep '/\._' >/dev/null; then
  EXPANDED_PKG="$BUILD_DIR/expanded-pkg"
  /usr/sbin/pkgutil --expand "$PKG_PATH" "$EXPANDED_PKG"
  PAYLOAD_PATH="$(/usr/bin/find "$EXPANDED_PKG" -type f -name Payload -print -quit)"
  COMPONENT_DIR="$(dirname "$PAYLOAD_PATH")"
  (
    cd "$STAGE_ROOT"
    /usr/bin/find . -print | COPYFILE_DISABLE=1 COPY_EXTENDED_ATTRIBUTES_DISABLE=1 /usr/bin/cpio -o --format odc 2>/dev/null | /usr/bin/gzip -c > "$COMPONENT_DIR/Payload"
  )
  /usr/bin/mkbom "$STAGE_ROOT" "$COMPONENT_DIR/Bom"
  /usr/sbin/pkgutil --flatten "$EXPANDED_PKG" "$UNSIGNED_PKG_PATH"
  /usr/bin/productsign --sign "$INSTALLER_IDENTITY" "$UNSIGNED_PKG_PATH" "$PKG_PATH"
fi

if /usr/sbin/pkgutil --payload-files "$PKG_PATH" | /usr/bin/grep '/\._' >/dev/null; then
  echo "Package still contains AppleDouble sidecar files." >&2
  exit 1
fi

if [ -e "$DIST_APP_PATH" ]; then
  mv "$DIST_APP_PATH" "$DIST_APP_PATH.backup-$(date +%Y%m%d%H%M%S)"
fi
/usr/bin/ditto --norsrc --noextattr "$CLEAN_APP_PATH" "$DIST_APP_PATH"
strip_metadata "$DIST_APP_PATH"

echo "$PKG_PATH"
