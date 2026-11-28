import React, { useEffect, useState } from "react";
import { View, ScrollView } from "react-native";
import { Text, TextInput } from "../../ui";
import { adminApi, SiteSettings } from "../../api/admin";
import { errorMessage } from "../../api/client";
import { colors } from "../../theme/colors";
import { ActionButton, ErrorText, ScreenLoader, Section, SuccessText, formatDateTime, ui } from "./adminUi";

// The settings the backend acts on. The OTP fields it stores are not used (OTP rules come
// from the server environment), so they are left out here.
type Field = "match_threshold" | "post_expiry_days" | "admin_review_sla_hours" | "abuse_auto_hide_threshold";

const FIELDS: { key: Field; label: string; help: string; min: number; max: number; decimal?: boolean }[] = [
  {
    key: "match_threshold",
    label: "Match threshold (0.30 – 0.95)",
    help: "Lowest score for a lost/found pair to reach the match queue. Higher means fewer, surer matches.",
    min: 0.3,
    max: 0.95,
    decimal: true,
  },
  {
    key: "post_expiry_days",
    label: "Days a post stays listed (7 – 365)",
    help: "Counted from approval or the last renewal. Owners are reminded 5 days before.",
    min: 7,
    max: 365,
  },
  {
    key: "admin_review_sla_hours",
    label: "Review SLA in hours (1 – 168)",
    help: "Reports waiting longer than this are flagged overdue and admins are alerted.",
    min: 1,
    max: 168,
  },
  {
    key: "abuse_auto_hide_threshold",
    label: "Abuse reports before auto-hide (0 – 20)",
    help: "A post is hidden once this many different students report it. 0 turns auto-hide off.",
    min: 0,
    max: 20,
  },
];

export const AdminSettingsScreen: React.FC = () => {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [draft, setDraft] = useState<Record<Field, string>>({
    match_threshold: "",
    post_expiry_days: "",
    admin_review_sla_hours: "",
    abuse_auto_hide_threshold: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const applySettings = (s: SiteSettings) => {
    setSettings(s);
    setDraft({
      match_threshold: String(s.match_threshold),
      post_expiry_days: String(s.post_expiry_days),
      admin_review_sla_hours: String(s.admin_review_sla_hours),
      abuse_auto_hide_threshold: String(s.abuse_auto_hide_threshold),
    });
  };

  useEffect(() => {
    adminApi
      .getSettings()
      .then(applySettings)
      .catch((err) => setError(errorMessage(err, "Failed to load site settings.")));
  }, []);

  const save = async () => {
    if (!settings) return;
    const changes: Partial<SiteSettings> = {};
    for (const field of FIELDS) {
      const value = Number(draft[field.key]);
      if (!Number.isFinite(value) || value < field.min || value > field.max || (!field.decimal && !Number.isInteger(value))) {
        setError(`${field.label.split(" (")[0]} must be ${field.decimal ? "a number" : "a whole number"} from ${field.min} to ${field.max}.`);
        return;
      }
      if (value !== settings[field.key]) (changes as any)[field.key] = value;
    }
    if (Object.keys(changes).length === 0) {
      setSuccess("Nothing changed.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await adminApi.updateSettings(changes);
      applySettings(result.settings);
      setSuccess(result.message);
    } catch (err: any) {
      setError(errorMessage(err, "Failed to save the settings."));
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return error ? (
      <View style={ui.center}>
        <ErrorText message={error} />
      </View>
    ) : (
      <ScreenLoader />
    );
  }

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.scroll} keyboardShouldPersistTaps="handled">
      <Section title="Campus site settings">
        {FIELDS.map((field) => (
          <View key={field.key}>
            <Text style={ui.label}>{field.label}</Text>
            <TextInput
              value={draft[field.key]}
              onChangeText={(text) => setDraft((prev) => ({ ...prev, [field.key]: text }))}
              keyboardType={field.decimal ? "decimal-pad" : "number-pad"}
              style={ui.input}
              placeholderTextColor={colors.textMuted}
            />
            <Text style={[ui.muted, { marginTop: 4 }]}>{field.help}</Text>
          </View>
        ))}
        <ErrorText message={error} />
        <SuccessText message={success} />
        <View style={ui.actions}>
          <ActionButton label={saving ? "Saving…" : "Save settings"} onPress={save} disabled={saving} />
        </View>
        {settings.updated_at ? <Text style={[ui.muted, { marginTop: 8 }]}>Last changed {formatDateTime(settings.updated_at)}</Text> : null}
      </Section>
    </ScrollView>
  );
};
