import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { colors } from "../theme/colors";
import { radii } from "../theme/tokens";
import { haptics } from "./haptics";
import { IconType } from "./icons";
import { PressableScale } from "./PressableScale";
import { Text } from "./Text";

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconType;
  /** A number shown after the label, e.g. how many reports have this status. */
  count?: number;
  style?: StyleProp<ViewStyle>;
}

/** A selectable filter pill. */
export const Chip: React.FC<ChipProps> = ({ label, selected, onPress, icon: Icon, count, style }) => {
  const fg = selected ? colors.textWhite : colors.textPrimary;
  return (
    <PressableScale
      onPress={() => {
        if (!selected) haptics.select();
        onPress?.();
      }}
      scaleTo={0.95}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={[styles.chip, selected ? styles.selected : styles.idle, style]}
    >
      {Icon ? <Icon size={16} color={selected ? colors.textWhite : colors.textSecondary} strokeWidth={2} /> : null}
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
      {count != null ? (
        <View style={[styles.count, selected && styles.countSelected]}>
          <Text style={[styles.countText, { color: selected ? colors.textWhite : colors.textSecondary }]}>{count}</Text>
        </View>
      ) : null}
    </PressableScale>
  );
};

/** The chip the older admin screens import. */
export const CategoryChip: React.FC<{ label: string; selected: boolean; onPress: () => void }> = (props) => (
  <Chip {...props} style={{ marginRight: 8 }} />
);

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  idle: { backgroundColor: colors.surface, borderColor: colors.border },
  selected: { backgroundColor: colors.charcoal, borderColor: colors.charcoal },
  label: { fontSize: 13, lineHeight: 17, fontWeight: "500" },
  count: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  countSelected: { backgroundColor: "rgba(255,255,255,0.18)" },
  countText: { fontSize: 11, lineHeight: 13, fontWeight: "600" },
});
