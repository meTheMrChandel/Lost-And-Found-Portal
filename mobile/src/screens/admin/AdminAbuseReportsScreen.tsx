import React, { useCallback, useState } from "react";
import { View, FlatList, RefreshControl } from "react-native";
import { Badge, Text } from "../../ui";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import { adminApi, AbuseReport } from "../../api/admin";
import { errorMessage } from "../../api/client";
import { colors } from "../../theme/colors";
import { statusBadge } from "../reports/reportStatus";
import { ActionButton, ChipFilter, EmptyState, ErrorText, ScreenLoader, SuccessText, formatDateTime, humanize, ui } from "./adminUi";

type Nav = NativeStackNavigationProp<RootStackParamList>;
const VIEWS = ["open", "resolved"] as const;

export const AdminAbuseReportsScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const [view, setView] = useState<(typeof VIEWS)[number] | "">("open");
  const [reports, setReports] = useState<AbuseReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    try {
      setReports(await adminApi.getAbuseReports(view === "resolved"));
      setError("");
    } catch (err: any) {
      setError(errorMessage(err, "Failed to load abuse reports."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [view]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const act = async (report: AbuseReport, fn: () => Promise<string>) => {
    setBusyId(report.id);
    setError("");
    setSuccess("");
    try {
      setSuccess(await fn());
      await load();
    } catch (err: any) {
      setError(errorMessage(err, "That action failed."));
    } finally {
      setBusyId("");
    }
  };

  const renderItem = ({ item }: { item: AbuseReport }) => {
    const postBadge = statusBadge(item.post_status);
    const busy = busyId === item.id;
    return (
      <View style={ui.card}>
        <View style={ui.badgeRow}>
          <Badge label={humanize(item.reason)} variant="lost" />
          <Badge label={`Post: ${postBadge.label}`} variant={postBadge.variant} />
          {item.is_resolved ? <Badge label="Resolved" variant="approved" /> : null}
        </View>
        <Text style={ui.cardTitle}>{item.post_title}</Text>
        {item.description ? <Text style={[ui.body, { marginBottom: 4 }]}>{item.description}</Text> : null}
        <Text style={ui.muted}>
          Reported by {item.reporter_name || "a deleted account"} · {formatDateTime(item.created_at)}
          {item.resolved_by_email ? ` · resolved by ${item.resolved_by_email.split("@")[0]}` : ""}
        </Text>
        <View style={ui.actions}>
          <ActionButton
            label="Open case"
            tone="neutral"
            onPress={() => navigation.navigate("AdminCaseDetail", { postId: item.post })}
          />
          {item.post_status === "HIDDEN" ? (
            <ActionButton
              label="Restore post"
              tone="neutral"
              disabled={busy}
              onPress={() =>
                act(item, async () =>
                  (await adminApi.reviewCase(item.post, { action: "APPROVE", remarks: "Restored after reviewing abuse reports." })).message
                )
              }
            />
          ) : ["APPROVED", "PENDING", "INFO_REQUESTED"].includes(item.post_status) ? (
            <ActionButton
              label="Hide post"
              tone="warning"
              disabled={busy}
              onPress={() =>
                act(item, async () =>
                  (
                    await adminApi.reviewCase(item.post, {
                      action: "HIDE",
                      remarks: `Hidden after an abuse report (${humanize(item.reason).toLowerCase()}).`,
                    })
                  ).message
                )
              }
            />
          ) : null}
          {!item.is_resolved ? (
            <ActionButton label="Mark resolved" disabled={busy} onPress={() => act(item, () => adminApi.resolveAbuseReport(item.id))} />
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View style={ui.screen}>
      <ChipFilter options={VIEWS} value={view} onChange={(v) => setView(v || "open")} label={(v) => (v === "open" ? "Open" : "Resolved")} />
      <View style={{ paddingHorizontal: 16 }}>
        <ErrorText message={error} />
        <SuccessText message={success} />
      </View>
      {loading ? (
        <ScreenLoader />
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingTop: 4, flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            error ? undefined : (
              <EmptyState title={view === "resolved" ? "No resolved reports" : "No open abuse reports"} body="Reports students flag appear here." />
            )
          }
        />
      )}
    </View>
  );
};
