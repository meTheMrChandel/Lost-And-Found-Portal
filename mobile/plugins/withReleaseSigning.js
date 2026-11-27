/**
 * Expo config plugin: sign Android release builds with the team's own key.
 *
 * `expo prebuild` regenerates android/, and its release build type is signed with the
 * public debug keystore. This adds a `release` signing config read from Gradle properties,
 * used whenever they are set (scripts/build-android-release.sh sets them):
 *
 *   LOSTANDFOUND_RELEASE_STORE_FILE      absolute path to the .jks file (kept out of the repo)
 *   LOSTANDFOUND_RELEASE_STORE_PASSWORD
 *   LOSTANDFOUND_RELEASE_KEY_ALIAS
 *   LOSTANDFOUND_RELEASE_KEY_PASSWORD
 *
 * Without them a release build falls back to the debug key, as before.
 */
const { withAppBuildGradle } = require("expo/config-plugins");

const MARKER = "LOSTANDFOUND_RELEASE_STORE_FILE";

const RELEASE_SIGNING_CONFIG = `signingConfigs {
        release {
            if (project.hasProperty("${MARKER}")) {
                storeFile file(project.property("${MARKER}"))
                storePassword project.property("LOSTANDFOUND_RELEASE_STORE_PASSWORD")
                keyAlias project.property("LOSTANDFOUND_RELEASE_KEY_ALIAS")
                keyPassword project.property("LOSTANDFOUND_RELEASE_KEY_PASSWORD")
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes(MARKER)) return cfg;

    if (!/signingConfigs \{/.test(gradle) || !/release \{[^}]*signingConfig signingConfigs\.debug/s.test(gradle)) {
      throw new Error("withReleaseSigning: android/app/build.gradle no longer has the expected signing blocks");
    }

    // Declare the release signing config next to the generated debug one
    gradle = gradle.replace(/signingConfigs \{/, RELEASE_SIGNING_CONFIG);

    // Release builds use it when the key is configured, the debug key otherwise
    gradle = gradle.replace(
      /(release \{[^}]*?)signingConfig signingConfigs\.debug/s,
      `$1signingConfig project.hasProperty("${MARKER}") ? signingConfigs.release : signingConfigs.debug`
    );

    cfg.modResults.contents = gradle;
    return cfg;
  });
};
