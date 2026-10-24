import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { colors } from "../theme/colors";

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  title = "Lost & Found",
  subtitle = "IIT ROPAR",
  showBack,
  onBack,
  rightAction,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.leftRow}>
        {showBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
        )}
        <View style={styles.logoBadge}>
          <Text style={styles.logoText}>LF</Text>
        </View>
        <View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>
      {rightAction && <View>{rightAction}</View>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 64,
    paddingHorizontal: 16,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  leftRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    marginRight: 10,
    padding: 6,
  },
  backIcon: {
    fontSize: 22,
    color: colors.textPrimary,
    fontWeight: "bold",
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  logoText: {
    color: colors.textWhite,
    fontSize: 16,
    fontWeight: "bold",
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.ocean,
    letterSpacing: 1,
  },
});
