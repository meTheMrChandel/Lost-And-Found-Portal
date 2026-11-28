import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import { MyReport, postsApi } from "../../api/posts";
import { errorMessage } from "../../api/client";
import {
  Badge,
  Button,
  ErrorState,
  haptics,
  Notice,
  Screen,
  SectionHeader,
  Skeleton,
  Text,
  TextField,
  useToast,
} from "../../ui";
import {
  CalendarClock,
  ExternalLink,
  Gift,
  IconType,
  MapPin,
  RefreshCw,
  Send,
  Tag,
  Timer,
  Undo2,
} from "../../ui/icons";
import { colors } from "../../theme/colors";
import { radii } from "../../theme/tokens";
import { formatDate, formatDateTime, formatRupees } from "../../utils/format";
import { ItemThumb } from "../feed/FeedCard";
import { statusMeta } from "./reportStatus";

type Props = NativeStackScreenProps<RootStackParamList, "MyReportDetail">;

const Row: React.FC<{ icon: IconType; label: string; value: string }> = ({ icon: Icon, label, value }) => (
  <View style={styles.row}>
    <Icon size={18} color={colors.textSecondary} strokeWidth={2} />
    <Text variant="callout" color="textSecondary" style={{ width: 104 }}>
      {label}
    </Text>
    <Text variant="calloutMedium" style={{ flex: 1 }}>
      {value}
    </Text>
  </View>
);

export const MyReportDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { reportId } = route.params;
  const toast = useToast();

  const [report, setReport] = useState<MyReport | null>(route.params.report || null);
  const [detailLoaded, setDetailLoaded] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"renew" | "withdraw" | "update" | null>(null);

  // Answering an info request
  const [description, setDescription] = useState("");
  const [place, setPlace] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const full = await postsApi.getMyReportDetail(reportId);
      setReport(full);
      setDescription(full.description || "");
      setPlace(full.last_seen_place || "");
      setDetailLoaded(true);
    } catch (err: any) {
      setError(errorMessage(err, "Couldn't load this report."));
    }
  }, [reportId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!report) {
    return error ? (
      <Screen>
        <ErrorState message={error} onRetry={load} style={{ flex: 1 }} />
      </Screen>
    ) : (
      <Screen scroll>
        <View style={{ gap: 14 }}>
          <Skeleton height={96} radius={radii.lg} />
          <Skeleton height={120} radius={radii.lg} />
          <Skeleton height={160} radius={radii.lg} />
        </View>
      </Screen>
    );
  }

  const meta = statusMeta(report.status);
  const isLost = report.post_type === "LOST";
  const canRenew = report.status === "APPROVED" || report.status === "EXPIRED";
  const canWithdraw = report.status === "PENDING" || report.status === "INFO_REQUESTED";
  const answering = report.status === "INFO_REQUESTED";
  const changed =
    description.trim() !== (report.description || "").trim() || place.trim() !== (report.last_seen_place || "").trim();

  const done = (message: string) => {
    haptics.success();
    toast.show(message);
    navigation.goBack();
  };

  const renew = async () => {
    setBusy("renew");
    try {
      const res = await postsApi.renewPost(report.id);
      done(res.message || "Your report is listed again.");
    } catch (err: any) {
      toast.show(errorMessage(err, "Couldn't renew this report."), "error");
      setBusy(null);
    }
  };

  const withdraw = () => {
    Alert.alert("Withdraw this report?", "It will be removed and won't be reviewed. This can't be undone.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Withdraw",
        style: "destructive",
        onPress: async () => {
          setBusy("withdraw");
          try {
            const res = await postsApi.withdrawReport(report.id);
            done(res?.message || "Report withdrawn.");
          } catch (err: any) {
            toast.show(errorMessage(err, "Couldn't withdraw this report."), "error");
            setBusy(null);
          }
        },
      },
    ]);
  };

  const sendUpdate = async () => {
    if (!place.trim()) {
      toast.show("Add where you last saw it.", "error");
      return;
    }
    setBusy("update");
    try {
      const res = await postsApi.updateReport(report.id, {
        description: description.trim(),
        last_seen_place: place.trim(),
      });
      done(res.message || "Update sent. Your report is back with the admin.");
    } catch (err: any) {
      toast.show(errorMessage(err, "Couldn't send your update."), "error");
      setBusy(null);
    }
  };

  const footer =
    answering || canRenew || canWithdraw ? (
      <View style={{ gap: 10 }}>
        {answering ? (
          <Button
            title="Send update to admin"
            icon={Send}
            size="lg"
            fullWidth
            loading={busy === "update"}
            disabled={!detailLoaded || !changed || busy !== null}
            onPress={sendUpdate}
          />
        ) : null}
        {canRenew ? (
          <Button
            title={report.status === "EXPIRED" ? "Renew listing" : "Extend listing"}
            icon={RefreshCw}
            size="lg"
            fullWidth
            loading={busy === "renew"}
            disabled={busy !== null}
            onPress={renew}
          />
        ) : null}
        {canWithdraw ? (
          <Button
            title="Withdraw report"
            icon={Undo2}
            variant="dangerSoft"
            size="lg"
            fullWidth
            loading={busy === "withdraw"}
            disabled={busy !== null}
            onPress={withdraw}
          />
        ) : null}
      </View>
    ) : undefined;

  return (
    <Screen scroll footer={footer}>
      <View style={styles.summary}>
        <ItemThumb
          post={{ images: report.images, post_type: isLost ? "lost" : "found", category: report.category }}
          size={72}
        />
        <View style={{ flex: 1 }}>
          <Badge label={isLost ? "Lost report" : "Found report"} tone={isLost ? "danger" : "success"} dot />
          <Text variant="title2" style={{ marginTop: 6 }}>
            {report.title}
          </Text>
        </View>
      </View>

      <View style={[styles.statusCard, { borderColor: colors.border }]}>
        <View style={styles.statusHead}>
          <Badge label={meta.label} tone={meta.tone} icon={meta.icon} size="md" />
          <Text variant="caption" color="textMuted">
            Submitted {formatDate(report.created_at)}
          </Text>
        </View>
        {meta.description ? (
          <Text variant="callout" color="textSecondary" style={{ marginTop: 10 }}>
            {meta.description}
          </Text>
        ) : null}
        {report.admin_remarks ? (
          <View style={styles.remark}>
            <Text variant="overline" color="textSecondary">
              Note from the admin
            </Text>
            <Text variant="body" style={{ marginTop: 4 }}>
              {report.admin_remarks}
            </Text>
          </View>
        ) : null}
      </View>

      {answering ? (
        <>
          <SectionHeader title="Update your report" style={{ marginTop: 22 }} />
          <Notice
            tone="info"
            message="Edit the details the admin asked about, then send it back for review."
            style={{ marginBottom: 16 }}
          />
          <TextField
            label="Description"
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={1000}
            showCount
            editable={detailLoaded}
          />
          <TextField
            label="Last seen at"
            icon={MapPin}
            value={place}
            onChangeText={setPlace}
            maxLength={300}
            editable={detailLoaded}
          />
        </>
      ) : null}

      <SectionHeader title="Details" style={{ marginTop: 22 }} />
      <View style={styles.card}>
        {report.category_name ? <Row icon={Tag} label="Category" value={report.category_name} /> : null}
        <Row icon={MapPin} label={isLost ? "Last seen" : "Found at"} value={report.last_seen_place} />
        <Row
          icon={CalendarClock}
          label={isLost ? "Lost on" : "Found on"}
          value={formatDateTime(report.last_seen_time)}
        />
        {Number(report.reward_amount) > 0 ? (
          <Row icon={Gift} label="Reward" value={formatRupees(report.reward_amount)} />
        ) : null}
        {report.expires_at && report.status === "APPROVED" ? (
          <Row icon={Timer} label="Listed until" value={formatDate(report.expires_at)} />
        ) : null}
      </View>

      {!answering && report.description ? (
        <>
          <SectionHeader title="Description" style={{ marginTop: 22 }} />
          <Text variant="body" style={{ lineHeight: 23 }}>
            {report.description}
          </Text>
        </>
      ) : null}

      {report.images.length ? (
        <>
          <SectionHeader title="Photos" style={{ marginTop: 22 }} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {report.images.map((img) => (
              <Image
                key={img.id}
                source={{ uri: img.image_url }}
                style={styles.photo}
                contentFit="cover"
                transition={150}
              />
            ))}
          </ScrollView>
        </>
      ) : null}

      {report.status === "APPROVED" ? (
        <Button
          title="See it on the feed"
          icon={ExternalLink}
          variant="ghost"
          onPress={() => navigation.navigate("ItemDetail", { postId: report.id })}
          style={{ alignSelf: "center", marginTop: 18 }}
        />
      ) : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  summary: { flexDirection: "row", alignItems: "center", gap: 14 },
  statusCard: {
    marginTop: 20,
    padding: 16,
    borderRadius: radii.lg,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  statusHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  remark: {
    marginTop: 14,
    padding: 12,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceAlt,
    borderLeftWidth: 3,
    borderLeftColor: colors.borderStrong,
  },
  card: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11 },
  photo: { width: 132, height: 132, borderRadius: radii.md, backgroundColor: colors.surfaceAlt },
});
