import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { colors } from "../theme/colors";
import { radii } from "../theme/tokens";
import { IconType } from "./icons";
import { Text } from "./Text";

export type BadgeTone = "success" | "danger" | "warning" | "info" | "neutral" | "brand" | "reward" | "dark";
/** Names the older screens use; mapped onto tones. */
type LegacyVariant = "lost" | "found" | "pending" | "approved" | "info" | "default";

const TONES: Record<BadgeTone, { bg: string; fg: string }> = {
  success: { bg: colors.primaryTint, fg: colors.primary },
  brand: { bg: colors.primarySoft, fg: colors.primaryPressed },
  danger: { bg: colors.lostTint, fg: colors.lost },
  warning: { bg: colors.warningTint, fg: colors.warning },
  info: { bg: colors.infoTint, fg: colors.info },
  neutral: { bg: colors.surfaceAlt, fg: colors.textSecondary },
  reward: { bg: colors.rewardTint, fg: colors.reward },
  dark: { bg: "rgba(28,28,30,0.78)", fg: colors.textWhite },
};

const LEGACY: Record<LegacyVariant, BadgeTone> = {
  lost: "danger",
  found: "success",
  approved: "success",
  pending: "warning",
  info: "info",
  default: "neutral",
};

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  variant?: LegacyVariant;
  icon?: IconType;
  /** A coloured dot before the label. */
  dot?: boolean;
  size?: "sm" | "md";
  style?: StyleProp<ViewStyle>;
}

/** A small rounded status label. */
export const Badge: React.FC<BadgeProps> = ({ label, tone, variant, icon: Icon, dot, size = "sm", style }) => {
  const palette = TONES[tone || (variant ? LEGACY[variant] : "neutral")];
  const large = size === "md";
  return (
    <View style={[styles.badge, large && styles.badgeLarge, { backgroundColor: palette.bg }, style]}>
      {dot ? <View style={[styles.dot, { backgroundColor: palette.fg }]} /> : null}
      {Icon ? <Icon size={large ? 14 : 12} color={palette.fg} strokeWidth={2.4} /> : null}
      <Text style={[styles.text, large && styles.textLarge, { color: palette.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    paddingHorizontal: 8,
    height: 22,
    borderRadius: radii.pill,
  },
  badgeLarge: { height: 28, paddingHorizontal: 11, gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 11, lineHeight: 14, fontWeight: "600", letterSpacing: 0.2 },
  textLarge: { fontSize: 13, lineHeight: 16 },
});
