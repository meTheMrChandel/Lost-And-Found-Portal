import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { colors } from "../theme/colors";
import { radii, shadows } from "../theme/tokens";
import { PressableScale } from "./PressableScale";

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  onLongPress?: () => void;
  padded?: boolean;
  accessibilityLabel?: string;
}

/** White surface with a hairline border; pressable when given onPress. */
export const Card: React.FC<CardProps> = ({
  children,
  style,
  onPress,
  onLongPress,
  padded = true,
  accessibilityLabel,
}) => {
  const cardStyle = [styles.card, padded && styles.padded, style];
  if (onPress || onLongPress) {
    return (
      <PressableScale
        onPress={onPress}
        onLongPress={onLongPress}
        scaleTo={0.985}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={cardStyle}
      >
        {children}
      </PressableScale>
    );
  }
  return <View style={cardStyle}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  padded: { padding: 16 },
});
