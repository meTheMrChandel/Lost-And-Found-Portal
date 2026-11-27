/**
 * Small building blocks shared by the admin console screens.
 */
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import { CategoryChip } from "../../components/CategoryChip";
import { colors } from "../../theme/colors";

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** "PROOF_PENDING" → "Proof pending" */
export function humanize(value?: string | null): string {
  if (!value) return "—";
  const words = value.replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export const Section: React.FC<{ title?: string; children: React.ReactNode; style?: ViewStyle }> = ({
  title,
  children,
  style,
}) => (
  <View style={[ui.section, style]}>
    {title ? <Text style={ui.sectionTitle}>{title}</Text> : null}
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
    <FlatList
      horizontal
      style={{ flexGrow: 0 }}
      showsHorizontalScrollIndicator={false}
      data={items}
      keyExtractor={(item) => item || "__all"}
      contentContainerStyle={ui.chips}
      renderItem={({ item }) => (
        <CategoryChip
          label={item === "" ? allLabel || "All" : label ? label(item) : humanize(item)}
          selected={value === item}
          onPress={() => onChange(item)}
        />
      )}
    />
  );
}

export const ScreenLoader: React.FC = () => (
  <View style={ui.center}>
    <ActivityIndicator size="large" color={colors.primary} />
  </View>
);

export const EmptyState: React.FC<{ title: string; body?: string }> = ({ title, body }) => (
  <View style={ui.center}>
    <Text style={ui.emptyTitle}>{title}</Text>
    {body ? <Text style={ui.emptyBody}>{body}</Text> : null}
  </View>
);

export const ErrorText: React.FC<{ message?: string }> = ({ message }) =>
  message ? <Text style={ui.error}>{message}</Text> : null;

export const SuccessText: React.FC<{ message?: string }> = ({ message }) =>
  message ? <Text style={ui.success}>{message}</Text> : null;

/** A compact action button; `confirm` asks before running destructive actions. */
export const ActionButton: React.FC<{
  label: string;
  onPress: () => void;
  tone?: "primary" | "danger" | "neutral" | "warning";
  disabled?: boolean;
  confirm?: { title: string; message: string };
}> = ({ label, onPress, tone = "primary", disabled, confirm }) => {
  const palette = {
    primary: { bg: colors.primary, fg: colors.textWhite, border: colors.primary },
    danger: { bg: colors.lost, fg: colors.textWhite, border: colors.lost },
    warning: { bg: colors.warningLight, fg: colors.warning, border: colors.warning },
    neutral: { bg: colors.card, fg: colors.textPrimary, border: colors.border },
  }[tone];

  const handlePress = () => {
    if (!confirm) return onPress();
    Alert.alert(confirm.title, confirm.message, [
      { text: "Cancel", style: "cancel" },
      { text: label, style: tone === "danger" ? "destructive" : "default", onPress },
    ]);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[
        ui.actionButton,
        { backgroundColor: palette.bg, borderColor: palette.border },
        disabled && ui.actionDisabled,
      ]}
    >
      <Text style={[ui.actionText, { color: palette.fg }]}>{label}</Text>
    </TouchableOpacity>
  );
};

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  chips: { paddingHorizontal: 16, paddingVertical: 10 },
  section: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 13, fontWeight: "800", color: colors.textPrimary, marginBottom: 10 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 14,
    marginBottom: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: "bold", color: colors.textPrimary, marginBottom: 3 },
  meta: { fontSize: 12, color: colors.textSecondary, marginBottom: 2 },
  muted: { fontSize: 11, color: colors.textMuted },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  infoLabel: { fontSize: 12, color: colors.textSecondary, flexShrink: 0 },
  infoValue: { fontSize: 12, color: colors.textPrimary, fontWeight: "600", flex: 1, textAlign: "right" },
  body: { fontSize: 13, color: colors.textPrimary, lineHeight: 19 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  actionButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
  },
  actionDisabled: { opacity: 0.45 },
  actionText: { fontSize: 12, fontWeight: "700" },
  emptyTitle: { fontSize: 16, fontWeight: "bold", color: colors.textPrimary, marginBottom: 4, textAlign: "center" },
  emptyBody: { fontSize: 12, color: colors.textSecondary, textAlign: "center" },
  error: { color: colors.lost, fontSize: 12, fontWeight: "600", marginVertical: 6 },
  success: { color: colors.primary, fontSize: 12, fontWeight: "600", marginVertical: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.textPrimary,
  },
  label: { fontSize: 12, fontWeight: "700", color: colors.textSecondary, marginBottom: 6, marginTop: 10 },
});
