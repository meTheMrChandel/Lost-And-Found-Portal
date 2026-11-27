#!/usr/bin/env bash
# Builds a signed release APK of the Android app, connected to the hosted servers
# (app.json extra.apiUrl, or EXPO_PUBLIC_API_URL if set). No Expo account is needed.
#
# Needs Node, the Android SDK and a JDK 17+ (Android Studio ships both), and a signing key
# described by a properties file kept OUT of the repo:
#
#   storeFile=/absolute/path/lostandfound-release.jks
#   storePassword=...
#   keyAlias=lostandfound
#   keyPassword=...
#
# Usage: SIGNING_PROPERTIES=/path/to/keystore.properties mobile/scripts/build-android-release.sh
# Without SIGNING_PROPERTIES it looks for ../../lostandfound-android-signing/keystore.properties
# next to the repo, and falls back to the debug key (fine for testing, not for sharing).
# The APK is written to mobile/dist/.
set -euo pipefail

cd "$(dirname "$0")/.."
MOBILE_DIR="$(pwd)"

# Android Studio's bundled JDK and SDK on macOS, unless already configured
if [[ -z "${JAVA_HOME:-}" && -d "/Applications/Android Studio.app/Contents/jbr/Contents/Home" ]]; then
  export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
fi
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"

SIGNING_PROPERTIES="${SIGNING_PROPERTIES:-$MOBILE_DIR/../../lostandfound-android-signing/keystore.properties}"
if [[ -f "$SIGNING_PROPERTIES" ]]; then
  prop() { grep -E "^$1=" "$SIGNING_PROPERTIES" | head -1 | cut -d= -f2-; }
  export ORG_GRADLE_PROJECT_LOSTANDFOUND_RELEASE_STORE_FILE="$(prop storeFile)"
  export ORG_GRADLE_PROJECT_LOSTANDFOUND_RELEASE_STORE_PASSWORD="$(prop storePassword)"
  export ORG_GRADLE_PROJECT_LOSTANDFOUND_RELEASE_KEY_ALIAS="$(prop keyAlias)"
  export ORG_GRADLE_PROJECT_LOSTANDFOUND_RELEASE_KEY_PASSWORD="$(prop keyPassword)"
  echo "Signing with $(prop storeFile)"
else
  echo "No signing properties at $SIGNING_PROPERTIES: signing with the debug key (testing only)" >&2
fi

[[ -d node_modules ]] || npm ci
export NODE_ENV=production
CI=1 npx expo prebuild --platform android --clean --no-install
# prebuild rewrites the run scripts in package.json; keep the Expo Go ones the team uses
git checkout -- package.json 2>/dev/null || true

# Phones (and emulators on Apple-silicon Macs) are ARM; leaving out x86 halves the APK size.
# Set ANDROID_ARCHS=arm64-v8a,armeabi-v7a,x86,x86_64 for an x86 emulator.
ARCHS="${ANDROID_ARCHS:-arm64-v8a,armeabi-v7a}"
(cd android && ./gradlew assembleRelease --no-daemon -PreactNativeArchitectures="$ARCHS")

VERSION="$(node -p "require('./app.json').expo.version")"
mkdir -p dist
cp android/app/build/outputs/apk/release/app-release.apk "dist/LostAndFound-$VERSION.apk"
echo "Built dist/LostAndFound-$VERSION.apk"
