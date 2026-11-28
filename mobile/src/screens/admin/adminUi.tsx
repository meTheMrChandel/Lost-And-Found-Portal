/**
 * Building blocks shared by the admin console screens, on top of the app's design system.
 */
import React from "react";
import { Alert, ScrollView, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Button, ButtonVariant, Chip, EmptyState as BaseEmptyState, Notice, Skeleton, Text } from "../../ui";
import { IconType, Inbox } from "../../ui/icons";
import { colors } from "../../theme/colors";
import { radii, SCREEN_PADDING, typography } from "../../theme/tokens";
import { formatDateTime as formatStamp, humanize as humanizeValue } from "../../utils/format";

export function formatDateTime(iso?: string | null): string {
  return formatStamp(iso);
}

/** "PROOF_PENDING" → "Proof pending" */
export function humanize(value?: string | null): string {
  return humanizeValue(value);
}

/** A titled white card. */
export const Section: React.FC<{
  title?: string;
  icon?: IconType;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}> = ({ title, icon: Icon, children, style }) => (
  <View style={[ui.section, style]}>
    {title ? (
      <View style={styles.sectionHead}>
        {Icon ? <Icon size={16} color={colors.textSecondary} strokeWidth={2.2} /> : null}
        <Text variant="overline" color="textSecondary">
          {title}
        </Text>
      </View>
    ) : null}
    {children}
  </View>
);

export const InfoRow: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <View style={ui.infoRow}>
    <Text style={ui.infoLabel}>{label}</Text>
    {typeof value === "string" || typeof value === "number" || value == null ? (
      <Text style={ui.infoValue}>{value === "" || value == null ? "—" : String(value)}</Text>
    ) : (
      value
    )}
  </View>
);

/** Horizontal filter chips; value "" is the "All" option when allLabel is given. */
export function ChipFilter<T extends string>({
  options,
  value,
  onChange,
  allLabel,
  label,
}: {
  options: readonly T[];
  value: T | "";
  onChange: (value: T | "") => void;
  allLabel?: string;
  label?: (value: T) => string;
}) {
  const items: (T | "")[] = allLabel ? ["", ...options] : [...options];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
      contentContainerStyle={ui.chips}
    >
      {items.map((item) => (
        <Chip
          key={item || "__all"}
          label={item === "" ? allLabel || "All" : label ? label(item) : humanize(item)}
          selected={value === item}
          onPress={() => onChange(item)}
        />
      ))}
    </ScrollView>
  );
}

/** Card-shaped placeholders while a list or case loads. */
export const ScreenLoader: React.FC = () => (
  <View style={styles.loader}>
    {[0, 1, 2].map((i) => (
      <View key={i} style={styles.loaderCard}>
        <Skeleton width={90} height={20} radius={10} />
        <Skeleton width="80%" height={16} />
        <Skeleton width="55%" height={12} />
      </View>
    ))}
  </View>
);

export const EmptyState: React.FC<{ title: string; body?: string; icon?: IconType }> = ({ title, body, icon }) => (
  <BaseEmptyState icon={icon || Inbox} tone="neutral" title={title} body={body} compact />
);

export const ErrorText: React.FC<{ message?: string }> = ({ message }) =>
  message ? <Notice tone="danger" message={message} style={styles.notice} /> : null;

export const SuccessText: React.FC<{ message?: string }> = ({ message }) =>
  message ? <Notice tone="success" message={message} style={styles.notice} /> : null;

const TONE_TO_VARIANT: Record<string, ButtonVariant> = {
  primary: "primary",
  danger: "danger",
  neutral: "secondary",
  warning: "tonal",
};

/** A compact action button; `confirm` asks before running destructive actions. */
export const ActionButton: React.FC<{
  label: string;
  onPress: () => void;
  tone?: "primary" | "danger" | "neutral" | "warning";
  disabled?: boolean;
  confirm?: { title: string; message: string };
}> = ({ label, onPress, tone = "primary", disabled, confirm }) => {
  const handlePress = () => {
    if (!confirm) return onPress();
    Alert.alert(confirm.title, confirm.message, [
      { text: "Cancel", style: "cancel" },
      { text: label, style: tone === "danger" ? "destructive" : "default", onPress },
    ]);
  };
  return (
    <Button
      title={label}
      size="sm"
      variant={TONE_TO_VARIANT[tone]}
      onPress={handlePress}
      disabled={disabled}
      textStyle={tone === "warning" ? { color: colors.warning } : undefined}
      style={tone === "warning" ? { backgroundColor: colors.warningTint } : undefined}
    />
  );
};

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: SCREEN_PADDING, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  chips: { gap: 8, paddingHorizontal: SCREEN_PADDING, paddingVertical: 10 },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 14,
  },
  sectionTitle: { ...typography.overline, color: colors.textSecondary, marginBottom: 10 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  cardTitle: { ...typography.headline, color: colors.textPrimary, marginBottom: 3 },
  meta: { ...typography.footnote, color: colors.textSecondary, marginBottom: 2 },
  muted: { ...typography.caption, color: colors.textMuted },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  infoLabel: { ...typography.footnote, color: colors.textSecondary, flexShrink: 0 },
  infoValue: {
    ...typography.footnote,
    fontFamily: typography.subhead.fontFamily,
    color: colors.textPrimary,
    flex: 1,
    textAlign: "right",
  },
  body: { ...typography.callout, color: colors.textPrimary },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  actionButton: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radii.sm, borderWidth: 1 },
  actionDisabled: { opacity: 0.45 },
  actionText: { ...typography.subhead },
  emptyTitle: { ...typography.title3, color: colors.textPrimary, marginBottom: 4, textAlign: "center" },
  emptyBody: { ...typography.footnote, color: colors.textSecondary, textAlign: "center" },
  error: { ...typography.footnote, color: colors.lost, marginVertical: 6 },
  success: { ...typography.footnote, color: colors.primary, marginVertical: 6 },
  input: {
    ...typography.body,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.textPrimary,
  },
  label: { ...typography.subhead, color: colors.textPrimary, marginBottom: 8, marginTop: 12 },
});

const styles = StyleSheet.create({
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  loader: { padding: SCREEN_PADDING, gap: 12 },
  loaderCard: {
    gap: 10,
    padding: 16,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  notice: { marginVertical: 8 },
});
