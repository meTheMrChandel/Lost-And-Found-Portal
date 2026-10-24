import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { colors } from "../theme/colors";

interface CategoryChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: string;
}

export const CategoryChip: React.FC<CategoryChipProps> = ({
  label,
  selected,
  onPress,
  icon,
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.text, selected && styles.textSelected]}>
        {icon ? `${icon} ` : ""}
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  text: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  textSelected: {
    color: colors.textWhite,
  },
});
