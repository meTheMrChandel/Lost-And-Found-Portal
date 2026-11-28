import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { colors } from "../theme/colors";
import { radii } from "../theme/tokens";
import { ChevronRight, IconType } from "./icons";
import { PressableScale } from "./PressableScale";
import { Text } from "./Text";

interface ListItemProps {
  title: string;
  subtitle?: string;
  icon?: IconType;
  iconColor?: string;
  iconBackground?: string;
  /** Text at the right edge, before the chevron. */
  value?: string;
  /** Replaces the chevron, e.g. a switch or a badge. */
  right?: React.ReactNode;
  /** A count bubble before the chevron; hidden at 0. */
  badge?: number;
  onPress?: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

/** One row of a settings-style list. */
export const ListItem: React.FC<ListItemProps> = ({
  title,
  subtitle,
  icon: Icon,
  iconColor,
  iconBackground,
  value,
  right,
  badge,
  onPress,
  destructive,
  disabled,
}) => {
  const tint = destructive ? colors.danger : iconColor || colors.primary;
  const content = (
    <>
      {Icon ? (
        <View
          style={[
            styles.iconTile,
            { backgroundColor: iconBackground || (destructive ? colors.dangerTint : colors.primaryTint) },
          ]}
        >
          <Icon size={19} color={tint} strokeWidth={2} />
        </View>
      ) : null}
      <View style={styles.texts}>
        <Text variant="bodyMedium" color={destructive ? "danger" : "textPrimary"} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="footnote" color="textSecondary" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="callout" color="textSecondary" numberOfLines={1} style={styles.value}>
          {value}
        </Text>
      ) : null}
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
        </View>
      ) : null}
      {right !== undefined ? right : onPress ? <ChevronRight size={18} color={colors.textMuted} /> : null}
    </>
  );

  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.985}
      accessibilityRole="button"
      style={[styles.row, disabled && { opacity: 0.5 }]}
    >
      {content}
    </PressableScale>
  );
};

/** A card that stacks ListItems with hairline dividers between them. */
export const ListGroup: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle> }> = ({
  children,
  style,
}) => {
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[styles.group, style]}>
      {rows.map((row, i) => (
        <React.Fragment key={i}>
          {i > 0 ? <View style={styles.divider} /> : null}
          {row}
        </React.Fragment>
      ))}
    </View>
  );
};

/** Small uppercase heading above a group, with an optional action on the right. */
export const SectionHeader: React.FC<{ title: string; action?: React.ReactNode; style?: StyleProp<ViewStyle> }> = ({
  title,
  action,
  style,
}) => (
  <View style={[styles.sectionHeader, style]}>
    <Text variant="overline" color="textSecondary">
      {title}
    </Text>
    {action}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 60,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
  },
  iconTile: {
    width: 38,
    height: 38,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  texts: { flex: 1, gap: 2 },
  value: { maxWidth: "40%" },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: colors.lost,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: colors.textWhite, fontSize: 11, lineHeight: 13, fontWeight: "700" },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 68 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    marginTop: 8,
    paddingHorizontal: 4,
  },
});
