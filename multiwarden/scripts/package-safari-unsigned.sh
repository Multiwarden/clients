#!/usr/bin/env bash
# Multiwarden: packages an unsigned (ad-hoc signed) Safari build on macOS.
#
# Safari only loads web extensions that live inside a Mac app. This wraps the branded Safari
# build (apps/browser/build, made with BROWSER=safari) in Bitwarden's Xcode container project,
# with Multiwarden's own bundle IDs and no Apple team, and builds it with an ad-hoc signature.
#
# Usage (macOS, Xcode installed):
#   multiwarden/scripts/package-safari-unsigned.sh <output.zip>
#
# Installing: unzip, move Multiwarden.app to /Applications, open it once (right-click → Open the
# first time), then in Safari: Settings → Advanced → "Show features for web developers",
# Develop → "Allow Unsigned Extensions", and enable Multiwarden under Settings → Extensions.
# Safari turns "Allow Unsigned Extensions" off again when it quits.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
out="${1:?usage: package-safari-unsigned.sh <output.zip>}"
build="$root/apps/browser/build"
work="$root/apps/browser/dist/Safari/unsigned"

[ -f "$build/manifest.json" ] || { echo "No Safari build in $build" >&2; exit 1; }

version="$(/usr/bin/python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$build/manifest.json")"
short_version="$(echo "$version" | cut -d. -f1-3)"

rm -rf "$work"
mkdir -p "$work"
cp -R "$root/apps/browser/src/safari/." "$work/"
cp -R "$build" "$work/safari/app"

project="$work/desktop.xcodeproj/project.pbxproj"

# Same path fix as Bitwarden's package-safari.ps1.
perl -pi -e 's#\.\./\.\./\.\./build#../safari/app#g' "$project"

# Multiwarden's own identity instead of Bitwarden's Apple team and bundle IDs.
perl -pi -e 's/com\.bitwarden\.desktop\.safari/nl.mteij.multiwarden.safari/g; s/com\.bitwarden\.desktop/nl.mteij.multiwarden/g; s/DEVELOPMENT_TEAM = [A-Z0-9]+;/DEVELOPMENT_TEAM = "";/g' \
  "$project" "$work/safari/Info.plist" "$work/desktop/Info.plist" "$work/desktop/ViewController.swift"
perl -pi -e 's/com\.bitwarden\.desktop\.Extension/nl.mteij.multiwarden.safari/g' "$work/desktop/ViewController.swift"

# Versions and names.
for plist in "$work/safari/Info.plist" "$work/desktop/Info.plist"; do
  perl -pi -e "s/0\.0\.1/$short_version/g; s/0\.0\.2/$version/g; s/Copyright ©[^<]*/Multiwarden contributors. Based on Bitwarden (GPL-3.0)./g" "$plist"
done
perl -pi -e 's#<string>Bitwarden</string>#<string>Multiwarden</string>#' "$work/safari/Info.plist"
/usr/libexec/PlistBuddy -c "Delete :CFBundleDisplayName" "$work/desktop/Info.plist" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :CFBundleDisplayName string Multiwarden" "$work/desktop/Info.plist"

# Build with an ad-hoc signature: no Apple Developer account needed, and still runnable on
# Apple Silicon (which refuses completely unsigned code).
xcodebuild \
  -project "$work/desktop.xcodeproj" \
  -alltargets \
  -configuration Release \
  CODE_SIGN_IDENTITY="-" \
  CODE_SIGN_STYLE=Manual \
  DEVELOPMENT_TEAM="" \
  PROVISIONING_PROFILE_SPECIFIER="" \
  CODE_SIGNING_REQUIRED=NO \
  OTHER_CODE_SIGN_FLAGS="--timestamp=none"

app="$work/build/Release/desktop.app"
[ -x "$app/Contents/PlugIns/safari.appex/Contents/MacOS/safari" ] || {
  echo "Built app has no Safari extension executable" >&2
  exit 1
}

# Renaming the bundle folder keeps its signature valid (re-signing would drop the extension's
# sandbox entitlements, which Safari requires).
rm -rf "$work/Multiwarden.app"
mv "$app" "$work/Multiwarden.app"
codesign --verify --deep --verbose=1 "$work/Multiwarden.app"

mkdir -p "$(dirname "$out")"
rm -f "$out"
ditto -c -k --keepParent "$work/Multiwarden.app" "$out"
echo "Packaged unsigned Safari build: $out (version $version)"
