import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from "react-native";
import { colors } from "../theme/colors";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "ocean" | "lost" | "outline" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = "primary",
  disabled,
  loading,
  style,
  textStyle,
  icon,
}) => {
  const getBackgroundColor = () => {
    if (disabled) return "#D1D5DB";
    switch (variant) {
      case "ocean":
        return colors.ocean;
      case "lost":
        return colors.lost;
      case "outline":
      case "ghost":
        return "transparent";
      case "primary":
      default:
        return colors.primary;
    }
  };

  const getTextColor = () => {
    if (disabled) return "#9CA3AF";
    switch (variant) {
      case "outline":
      case "ghost":
        return colors.primary;
      case "ocean":
      case "lost":
      case "primary":
      default:
        return colors.textWhite;
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.button,
        { backgroundColor: getBackgroundColor() },
        variant === "outline" && styles.outlineBorder,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, { color: getTextColor() }, textStyle]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    gap: 8,
  },
  outlineBorder: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    elevation: 0,
  },
  text: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});
