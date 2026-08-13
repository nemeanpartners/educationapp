#!/usr/bin/env bash
set -euo pipefail
export COPYFILE_DISABLE=1
export COPY_EXTENDED_ATTRIBUTES_DISABLE=1

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NATIVE_DIR="$ROOT_DIR/native"
DIST_DIR="$ROOT_DIR/dist"
BUILD_DIR="$ROOT_DIR/dist/native-local-build-$(date +%Y%m%d%H%M%S)"
APP_PATH="$BUILD_DIR/EducationRev.app"
PKG_PATH="$DIST_DIR/EducationRev-1.1.1-universal-local.pkg"
APP_IDENTITY="Developer ID Application: Nemean Partners Pty Ltd. (7ZU4NQ9RVT)"
INSTALLER_IDENTITY="Developer ID Installer: Nemean Partners Pty Ltd. (7ZU4NQ9RVT)"

strip_metadata() {
  /usr/bin/xattr -cr "$APP_PATH" 2>/dev/null || true
  /usr/bin/xattr -dr com.apple.quarantine "$APP_PATH" 2>/dev/null || true
  /usr/bin/xattr -dr com.apple.provenance "$APP_PATH" 2>/dev/null || true
  /usr/bin/find "$APP_PATH" -name '._*' -delete
}

mkdir -p "$DIST_DIR" "$APP_PATH/Contents/MacOS" "$APP_PATH/Contents/Resources"

cp "$NATIVE_DIR/Info.plist" "$APP_PATH/Contents/Info.plist"
cp "$ROOT_DIR/build/icon.icns" "$APP_PATH/Contents/Resources/icon.icns"
strip_metadata

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
strip_metadata

/usr/bin/codesign \
  --force \
  --options runtime \
  --timestamp \
  --entitlements "$NATIVE_DIR/entitlements.local.plist" \
  --sign "$APP_IDENTITY" \
  "$APP_PATH"

strip_metadata

/usr/bin/productbuild \
  --component "$APP_PATH" /Applications \
  --sign "$INSTALLER_IDENTITY" \
  "$PKG_PATH"

echo "$PKG_PATH"
