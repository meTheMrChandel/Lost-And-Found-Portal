import React from "react";
import { ActivityIndicator, StyleProp, StyleSheet, TextStyle, View, ViewStyle } from "react-native";
import { colors } from "../theme/colors";
import { radii } from "../theme/tokens";
import { IconType } from "./icons";
import { PressableScale } from "./PressableScale";
import { Text } from "./Text";

export type ButtonVariant = "primary" | "secondary" | "tonal" | "outline" | "ghost" | "danger" | "dangerSoft";
type ButtonSize = "sm" | "md" | "lg";

const PALETTE: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.primary, fg: colors.textOnPrimary },
  secondary: { bg: colors.surface, fg: colors.textPrimary, border: colors.border },
  tonal: { bg: colors.primaryTint, fg: colors.primary },
  outline: { bg: "transparent", fg: colors.primary, border: colors.primary },
  ghost: { bg: "transparent", fg: colors.primary },
  danger: { bg: colors.danger, fg: colors.textWhite },
  dangerSoft: { bg: colors.dangerTint, fg: colors.danger },
};

const SIZES: Record<ButtonSize, { height: number; padding: number; font: number; icon: number; radius: number }> = {
  sm: { height: 36, padding: 14, font: 13, icon: 16, radius: radii.sm },
  md: { height: 48, padding: 18, font: 15, icon: 18, radius: radii.md },
  lg: { height: 54, padding: 20, font: 16, icon: 20, radius: radii.md },
};

export interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconType;
  iconRight?: IconType;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = "primary",
  size = "md",
  icon: Icon,
  iconRight: IconRight,
  loading,
  disabled,
  fullWidth,
  style,
  textStyle,
  accessibilityLabel,
}) => {
  const palette = PALETTE[variant];
  const dims = SIZES[size];
  const inactive = disabled || loading;

  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={[
        styles.base,
        {
          height: dims.height,
          paddingHorizontal: variant === "ghost" ? dims.padding - 6 : dims.padding,
          borderRadius: dims.radius,
          backgroundColor: palette.bg,
          borderColor: palette.border || "transparent",
          borderWidth: palette.border ? 1 : 0,
        },
        fullWidth && styles.fullWidth,
        disabled && !loading && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} size="small" />
      ) : (
        <View style={styles.content}>
          {Icon ? <Icon size={dims.icon} color={palette.fg} strokeWidth={2.2} /> : null}
          <Text
            numberOfLines={1}
            style={[{ fontSize: dims.font, color: palette.fg, fontWeight: "600", letterSpacing: 0.1 }, textStyle]}
          >
            {title}
          </Text>
          {IconRight ? <IconRight size={dims.icon} color={palette.fg} strokeWidth={2.2} /> : null}
        </View>
      )}
    </PressableScale>
  );
};

type IconButtonVariant = "plain" | "surface" | "tonal" | "primary" | "overlay";

const ICON_PALETTE: Record<IconButtonVariant, { bg: string; fg: string; border?: string }> = {
  plain: { bg: "transparent", fg: colors.textPrimary },
  surface: { bg: colors.surface, fg: colors.textPrimary, border: colors.border },
  tonal: { bg: colors.primaryTint, fg: colors.primary },
  primary: { bg: colors.primary, fg: colors.textWhite },
  overlay: { bg: "rgba(255,255,255,0.92)", fg: colors.textPrimary },
};

export interface IconButtonProps {
  icon: IconType;
  onPress?: () => void;
  accessibilityLabel: string;
  variant?: IconButtonVariant;
  size?: number;
  iconSize?: number;
  color?: string;
  /** A small count bubble in the corner; hidden at 0. */
  badge?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon: Icon,
  onPress,
  accessibilityLabel,
  variant = "plain",
  size = 42,
  iconSize = 21,
  color,
  badge,
  disabled,
  style,
}) => {
  const palette = ICON_PALETTE[variant];
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.92}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.iconButton,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: palette.bg,
          borderWidth: palette.border ? 1 : 0,
          borderColor: palette.border || "transparent",
        },
        disabled && styles.disabled,
        style,
      ]}
    >
      <Icon size={iconSize} color={color || palette.fg} strokeWidth={2} />
      {badge ? (
        <View style={styles.badge} pointerEvents="none">
          <Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
        </View>
      ) : null}
    </PressableScale>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  fullWidth: { alignSelf: "stretch" },
  disabled: { opacity: 0.45 },
  iconButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 3,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.lost,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 10, lineHeight: 12, color: colors.textWhite, fontWeight: "700" },
});
