#!/usr/bin/env bash
# Builds the shareable PhraseLoop package for the current operating system.
# macOS: dist/PhraseLoop-mac-arm64.dmg
# Linux: dist/PhraseLoop-<version>.AppImage
# Windows: dist/PhraseLoop-<version>-Setup.exe
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

clean_to_artifact() {
  local artifact="$1"
  find dist -mindepth 1 -maxdepth 1 ! -name "$(basename "$artifact")" -exec rm -rf {} +
}

print_size() {
  du -h "$1" | awk '{print $1}'
}

install_linux_appimage() {
  local appimage="$1"
  local xdg_data_home="${XDG_DATA_HOME:-$HOME/.local/share}"
  local install_dir="$xdg_data_home/PhraseLoop"
  local bin_dir="$HOME/.local/bin"
  local desktop_dir="$xdg_data_home/applications"
  local icon_dir="$xdg_data_home/icons/hicolor/512x512/apps"
  local installed_appimage="$install_dir/PhraseLoop.AppImage"
  local bin_link="$bin_dir/phraseloop"
  local desktop_file="$desktop_dir/phraseloop.desktop"
  local icon_file="$icon_dir/phraseloop.png"

  echo "→ Installing PhraseLoop for this Linux user..."
  mkdir -p "$install_dir" "$bin_dir" "$desktop_dir" "$icon_dir"
  cp "$appimage" "$installed_appimage"
  chmod 755 "$installed_appimage"
  ln -sfn "$installed_appimage" "$bin_link"
  cp electron/assets/icon.png "$icon_file"

  cat > "$desktop_file" <<EOF
[Desktop Entry]
Type=Application
Name=PhraseLoop
Comment=PhraseLoop desktop app
Exec=$installed_appimage
Icon=$icon_file
Terminal=false
Categories=Education;
StartupWMClass=PhraseLoop
EOF
  chmod 644 "$desktop_file"

  if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$desktop_dir" >/dev/null 2>&1 || true
  fi

  echo "  Installed AppImage: $installed_appimage"
  echo "  Installed command: $bin_link"
  echo "  Installed launcher: $desktop_file"
}

build_macos_download() {
  if [ "$(uname -m)" != "arm64" ]; then
    echo "✗ PhraseLoop macOS downloads must be built on Apple Silicon macOS."
    echo "  Detected: $(uname -s) $(uname -m)"
    exit 1
  fi

  # Mirror the arch-derived output dir used by electron/build-app.sh.
  ARCH_DIR="mac-arm64"
  APP="dist/$ARCH_DIR/PhraseLoop.app"
  DMG="dist/PhraseLoop-$ARCH_DIR.dmg"

  # Build the signed .app (Next + native addons + Electron).
  ./electron/build-app.sh

  if [ ! -d "$APP" ]; then
    echo "✗ Build did not produce $APP"
    exit 1
  fi

  echo "→ Building disk image..."
  # --prepackaged builds the DMG from the already post-processed & signed .app
  # (electron-builder's own `dmg` target would package an un-finished bundle).
  rm -f "$DMG"
  ./node_modules/.bin/electron-builder --mac dmg --prepackaged "$APP"

  # electron-builder names the dmg from productName + version; normalize to the
  # arch-tagged name the rest of the tooling/docs expect.
  PRODUCED_DMG="$(find dist -maxdepth 1 -type f -name "*.dmg" -print | head -1)"
  if [ -z "$PRODUCED_DMG" ]; then
    echo "✗ Disk image was not produced"
    exit 1
  fi
  if [ "$PRODUCED_DMG" != "$DMG" ]; then
    mv "$PRODUCED_DMG" "$DMG"
  fi

  DMG_BYTES="$(stat -f%z "$DMG")"
  MAX_DMG_BYTES=$((400 * 1024 * 1024))
  if [ "$DMG_BYTES" -gt "$MAX_DMG_BYTES" ]; then
    echo "✗ DMG exceeds the 400 MiB size budget: $(print_size "$DMG")"
    exit 1
  fi

  # The .app and electron-builder metadata are only intermediate artifacts. Keep
  # the download directory clean so this command leaves exactly one deliverable.
  clean_to_artifact "$DMG"

  echo ""
  echo "✓ Done: $ROOT/$DMG"
  echo "  Size: $(print_size "$DMG")"
  echo "  Share this file. The user opens the .dmg, drags PhraseLoop to Applications,"
  echo "  and opens it once (right-click -> Open the first time)."
}

build_linux_download() {
  PHRASELOOP_BUNDLE_KOKORO=1 ./electron/build-linux.sh
  APPIMAGE="$(find dist -maxdepth 1 -type f -name "*.AppImage" -print | head -1)"
  if [ -z "$APPIMAGE" ]; then
    echo "✗ AppImage was not produced"
    exit 1
  fi
  clean_to_artifact "$APPIMAGE"
  install_linux_appimage "$APPIMAGE"

  echo ""
  echo "✓ Done: $ROOT/$APPIMAGE"
  echo "  Size: $(print_size "$APPIMAGE")"
  echo "  Linux install complete. You can open PhraseLoop from your app launcher."
  echo "  Share this file with other users; they can mark it executable and open it."
}

build_windows_download() {
  ./electron/build-windows.sh
  INSTALLER="$(find dist -maxdepth 1 -type f -name "*.exe" -print | head -1)"
  if [ -z "$INSTALLER" ]; then
    echo "✗ Windows installer was not produced"
    exit 1
  fi
  clean_to_artifact "$INSTALLER"

  echo ""
  echo "✓ Done: $ROOT/$INSTALLER"
  echo "  Size: $(print_size "$INSTALLER")"
  echo "  Share this file. The user runs the installer to install PhraseLoop."
}

case "$(uname -s)" in
  Darwin)
    build_macos_download
    ;;
  Linux)
    build_linux_download
    ;;
  MINGW*|MSYS*|CYGWIN*)
    build_windows_download
    ;;
  *)
    echo "✗ Unsupported build platform: $(uname -s) $(uname -m)"
    exit 1
    ;;
esac
