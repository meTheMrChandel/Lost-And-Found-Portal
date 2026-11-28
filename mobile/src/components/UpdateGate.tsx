import React, { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import Constants from "expo-constants";
import * as SplashScreen from "expo-splash-screen";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppConfig, compareVersions, getAppConfig } from "../api/appConfig";
import { Button, Logo, Text } from "../ui";
import { Sparkles, X } from "../ui/icons";
import { colors } from "../theme/colors";
import { radii, SCREEN_PADDING } from "../theme/tokens";

const APP_VERSION = Constants.expoConfig?.version;

/**
 * Blocks versions the server no longer supports and offers newer ones.
 * If the check fails (offline, older server) the app just runs.
 */
export const UpdateGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const insets = useSafeAreaInsets();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!APP_VERSION) return;
    getAppConfig()
      .then((c) => {
        if (c?.min_supported_version && c?.latest_version) setConfig(c);
      })
      .catch(() => {});
  }, []);

  const blocked = !!config && !!APP_VERSION && compareVersions(APP_VERSION, config.min_supported_version) < 0;

  useEffect(() => {
    // The navigator normally hides the splash screen, but it isn't shown while blocked
    if (blocked) SplashScreen.hideAsync().catch(() => {});
  }, [blocked]);

  if (!config || !APP_VERSION) return <>{children}</>;

  const openUpdate = () => {
    if (config.update_url) Linking.openURL(config.update_url).catch(() => {});
  };

  if (blocked) {
    return (
      <View style={[styles.blocked, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 24 }]}>
        <Logo size={72} />
        <Text variant="title1" align="center" style={{ marginTop: 28 }}>
          Time to update
        </Text>
        <Text variant="body" color="textSecondary" align="center" style={styles.body}>
          This version ({APP_VERSION}) is no longer supported. Install version {config.latest_version} to keep using
          Lost & Found.
        </Text>
        <View style={{ flex: 1 }} />
        {config.update_url ? (
          <Button title="Download the update" onPress={openUpdate} size="lg" fullWidth />
        ) : (
          <Text variant="footnote" color="textSecondary" align="center">
            Ask the campus admin office for the latest version.
          </Text>
        )}
      </View>
    );
  }

  const outdated = compareVersions(APP_VERSION, config.latest_version) < 0;
  return (
    <View style={styles.fill}>
      <View style={styles.fill}>{children}</View>
      {outdated && !dismissed ? (
        <View style={[styles.banner, { bottom: insets.bottom + 84 }]} pointerEvents="box-none">
          <View style={styles.bannerCard}>
            <View style={styles.bannerIcon}>
              <Sparkles size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="subhead">Version {config.latest_version} is available</Text>
              <Text variant="caption" color="textSecondary">
                New fixes and improvements
              </Text>
            </View>
            {config.update_url ? <Button title="Update" size="sm" onPress={openUpdate} /> : null}
            <Pressable
              onPress={() => setDismissed(true)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
              style={styles.dismiss}
            >
              <X size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
  blocked: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: SCREEN_PADDING + 8,
    backgroundColor: colors.background,
  },
  body: { marginTop: 10, maxWidth: 320 },
  banner: { position: "absolute", left: 12, right: 12 },
  bannerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    paddingLeft: 14,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  bannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  dismiss: { padding: 2 },
});
