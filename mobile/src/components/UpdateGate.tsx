import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Linking } from "react-native";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppConfig, compareVersions, getAppConfig } from "../api/appConfig";
import { Button } from "./Button";
import { colors } from "../theme/colors";

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

  if (!config || !APP_VERSION) return <>{children}</>;

  const openStore = () => {
    if (config.update_url) Linking.openURL(config.update_url).catch(() => {});
  };

  if (compareVersions(APP_VERSION, config.min_supported_version) < 0) {
    return (
      <View style={[styles.blocked, { paddingTop: insets.top + 40 }]}>
        <Text style={styles.emoji}>⬆️</Text>
        <Text style={styles.title}>Update Required</Text>
        <Text style={styles.body}>
          This version ({APP_VERSION}) is no longer supported. Please install version{" "}
          {config.latest_version} to keep using Lost & Found.
        </Text>
        {config.update_url ? (
          <Button title="Update Now" onPress={openStore} style={styles.button} />
        ) : (
          <Text style={styles.body}>Ask the campus admin office for the latest version.</Text>
        )}
      </View>
    );
  }

  const outdated = compareVersions(APP_VERSION, config.latest_version) < 0;
  return (
    <View style={styles.fill}>
      {outdated && !dismissed ? (
        <View style={[styles.banner, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.bannerText}>Version {config.latest_version} is available.</Text>
          {config.update_url ? (
            <TouchableOpacity onPress={openStore}>
              <Text style={styles.bannerAction}>Update</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={() => setDismissed(true)}>
            <Text style={styles.bannerDismiss}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <View style={styles.fill}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
  blocked: { flex: 1, alignItems: "center", padding: 30, backgroundColor: colors.background },
  emoji: { fontSize: 44, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: "bold", color: colors.textPrimary, marginBottom: 8 },
  body: { fontSize: 13, color: colors.textSecondary, textAlign: "center", lineHeight: 19, marginBottom: 8 },
  button: { marginTop: 16, alignSelf: "stretch" },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: colors.primaryLight,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bannerText: { flex: 1, fontSize: 12, color: colors.textPrimary },
  bannerAction: { fontSize: 12, fontWeight: "700", color: colors.primary },
  bannerDismiss: { fontSize: 12, color: colors.textSecondary },
});
