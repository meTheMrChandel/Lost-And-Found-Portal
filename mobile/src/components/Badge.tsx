import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { colors } from "../theme/colors";

interface BadgeProps {
  label: string;
  variant?: "lost" | "found" | "pending" | "approved" | "info" | "default";
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = "default", style }) => {
  const getTheme = () => {
    switch (variant) {
      case "lost":
        return { bg: colors.lostLight, text: colors.lost };
      case "found":
      case "approved":
        return { bg: colors.foundLight, text: colors.found };
      case "pending":
        return { bg: colors.warningLight, text: colors.warning };
      case "info":
        return { bg: colors.oceanLight, text: colors.ocean };
      case "default":
      default:
        return { bg: colors.cardSubtle, text: colors.textSecondary };
    }
  };

  const theme = getTheme();

  return (
    <View style={[styles.badge, { backgroundColor: theme.bg }, style]}>
      <Text style={[styles.text, { color: theme.text }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
});
