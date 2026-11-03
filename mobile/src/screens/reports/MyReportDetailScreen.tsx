import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Image, Alert, ActivityIndicator } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import { postsApi, MyReport } from "../../api/posts";
import { errorMessage } from "../../api/client";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { colors } from "../../theme/colors";
import { formatDate, statusBadge } from "./reportStatus";

type Props = NativeStackScreenProps<RootStackParamList, "MyReportDetail">;

/** Lets the author answer an admin's request for more information. */
const UpdateReportForm: React.FC<{ reportId: string; onSent: (message: string) => void }> = ({ reportId, onSent }) => {
  // The list leaves out the description, so load the full report first
  const [original, setOriginal] = useState<MyReport | null>(null);
  const [description, setDescription] = useState("");
  const [place, setPlace] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    postsApi
      .getMyReportDetail(reportId)
      .then((row) => {
        if (cancelled) return;
        setOriginal(row);
        setDescription(row.description || "");
        setPlace(row.last_seen_place || "");
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, "Failed to load this report."));
      });
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  if (!original) {
    return error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.primary} />;
  }

  // Any edit sends the report back to review, so it must actually answer something
  const changed =
    description.trim() !== (original.description || "").trim() || place.trim() !== (original.last_seen_place || "").trim();

  const send = async () => {
    setSending(true);
    setError("");
    try {
      const res = await postsApi.updateReport(reportId, { description: description.trim(), last_seen_place: place.trim() });
      onSent(res.message || "Report updated and sent back for admin review.");
    } catch (err: any) {
      setError(errorMessage(err, "Failed to update your report."));
      setSending(false);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Update your report with the details the admin asked for</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Input label="Description" value={description} onChangeText={setDescription} multiline />
      <Input label="Last seen location" value={place} onChangeText={setPlace} />
      <Button title="Send Update to Admin" onPress={send} loading={sending} disabled={!changed || !place.trim() || sending} />
    </View>
  );
};

export const MyReportDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { report } = route.params;
  const [busy, setBusy] = useState<"renew" | "withdraw" | null>(null);
  const [error, setError] = useState("");
  const badge = statusBadge(report.status);
  const canRenew = report.status === "APPROVED" || report.status === "EXPIRED";
  const canWithdraw = report.status === "PENDING" || report.status === "INFO_REQUESTED";

  const finish = (message: string) => {
    Alert.alert("Done", message);
    navigation.goBack();
  };

  const renew = async () => {
    setBusy("renew");
    setError("");
    try {
      const res = await postsApi.renewPost(report.id);
      finish(res.message || "Report renewed.");
    } catch (err: any) {
      setError(errorMessage(err, "Failed to renew this report."));
      setBusy(null);
    }
  };

  const withdraw = () => {
    Alert.alert("Withdraw report", "Are you sure you want to withdraw this report?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Withdraw",
        style: "destructive",
        onPress: async () => {
          setBusy("withdraw");
          setError("");
          try {
            const res = await postsApi.withdrawReport(report.id);
            finish(res?.message || "Report withdrawn.");
          } catch (err: any) {
            setError(errorMessage(err, "Failed to withdraw this report."));
            setBusy(null);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.badgeRow}>
        <Badge label={badge.label} variant={badge.variant} />
        <Badge label={report.post_type === "LOST" ? "Lost" : "Found"} variant={report.post_type === "LOST" ? "lost" : "found"} />
      </View>
      {report.images.map((img) => (
        <Image key={img.id} source={{ uri: img.image_url }} style={styles.photo} />
      ))}
      <Text style={styles.title}>{report.title}</Text>

      <View style={styles.section}>
        <Text style={styles.row}><Text style={styles.label}>Category: </Text>{report.category_name || report.category}</Text>
        <Text style={styles.row}><Text style={styles.label}>Location: </Text>{report.last_seen_place}</Text>
        <Text style={styles.row}><Text style={styles.label}>Date: </Text>{formatDate(report.last_seen_time)}</Text>
        {Number(report.reward_amount) > 0 ? (
          <Text style={styles.row}><Text style={styles.label}>Promised reward: </Text>₹{report.reward_amount}</Text>
        ) : null}
        {report.expires_at && report.status === "APPROVED" ? (
          <Text style={styles.row}><Text style={styles.label}>Listed until: </Text>{formatDate(report.expires_at)}</Text>
        ) : null}
      </View>

      {report.admin_remarks ? (
        <View style={styles.note}>
          <Text style={styles.noteLabel}>Admin review notes</Text>
          <Text style={styles.noteText}>{report.admin_remarks}</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {report.status === "INFO_REQUESTED" ? <UpdateReportForm reportId={report.id} onSent={finish} /> : null}

      {canRenew ? (
        <Button title="Renew Listing" onPress={renew} loading={busy === "renew"} disabled={busy !== null} style={styles.action} />
      ) : null}
      {canWithdraw ? (
        <Button title="Withdraw Report" variant="outline" onPress={withdraw} loading={busy === "withdraw"} disabled={busy !== null} style={styles.action} />
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
  badgeRow: { flexDirection: "row", gap: 6, marginBottom: 12 },
  photo: { width: "100%", height: 200, borderRadius: 16, marginBottom: 12, backgroundColor: colors.cardSubtle },
  title: { fontSize: 20, fontWeight: "bold", color: colors.textPrimary, marginBottom: 12 },
  section: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 13, fontWeight: "bold", color: colors.textPrimary, marginBottom: 12 },
  row: { fontSize: 13, color: colors.textPrimary, marginBottom: 6 },
  label: { color: colors.textSecondary, fontWeight: "600" },
  note: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  noteLabel: { fontSize: 12, fontWeight: "700", color: colors.primary, marginBottom: 4 },
  noteText: { fontSize: 13, color: colors.textPrimary },
  error: { color: colors.lost, fontSize: 12, fontWeight: "600", marginBottom: 10 },
  action: { marginBottom: 10 },
});
