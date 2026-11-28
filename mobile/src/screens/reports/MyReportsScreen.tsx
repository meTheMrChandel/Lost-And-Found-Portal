import React, { memo, useCallback, useMemo, useRef, useState } from "react";
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute, useScrollToTop } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import { MyReport, postsApi } from "../../api/posts";
import { errorMessage } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { ReportChooser } from "../../components/ReportChooser";
import {
  Badge,
  Card,
  CardSkeleton,
  Chip,
  EmptyState,
  ErrorState,
  IconButton,
  ScreenHeader,
  Text,
  useToast,
} from "../../ui";
import { ChevronRight, CircleAlert, ClipboardList, LockKeyhole, MapPin, Plus } from "../../ui/icons";
import { colors } from "../../theme/colors";
import { radii, SCREEN_PADDING } from "../../theme/tokens";
import { formatDate } from "../../utils/format";
import { ItemThumb } from "../feed/FeedCard";
import { REPORT_TABS, statusMeta, tabLabel } from "./reportStatus";

type Nav = NativeStackNavigationProp<RootStackParamList>;

function footnoteFor(report: MyReport): string {
  if (report.status === "APPROVED" && report.expires_at) return `Live until ${formatDate(report.expires_at)}`;
  if (report.status === "PENDING") return `Submitted ${formatDate(report.created_at)} · waiting for review`;
  return `Submitted ${formatDate(report.created_at)}`;
}

const ReportCard = memo<{ report: MyReport; onPress: (r: MyReport) => void }>(({ report, onPress }) => {
  const meta = statusMeta(report.status);
  const isLost = report.post_type === "LOST";
  const needsReply = report.status === "INFO_REQUESTED";
  return (
    <Card
      onPress={() => onPress(report)}
      padded={false}
      style={styles.card}
      accessibilityLabel={`${report.title}, ${meta.label}`}
    >
      <View style={styles.cardRow}>
        <ItemThumb
          post={{ images: report.images, post_type: isLost ? "lost" : "found", category: report.category }}
          size={76}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.badges}>
            <Badge label={meta.label} tone={meta.tone} icon={meta.icon} />
            <Badge label={isLost ? "Lost" : "Found"} tone={isLost ? "danger" : "success"} dot />
          </View>
          <Text variant="headline" numberOfLines={2} style={{ marginTop: 6 }}>
            {report.title}
          </Text>
          <View style={styles.meta}>
            <MapPin size={13} color={colors.textMuted} />
            <Text variant="footnote" color="textSecondary" numberOfLines={1} style={{ flex: 1 }}>
              {report.last_seen_place}
            </Text>
          </View>
          <Text variant="caption" color="textMuted" style={{ marginTop: 4 }}>
            {footnoteFor(report)}
          </Text>
        </View>
      </View>
      {needsReply || (report.status === "REJECTED" && report.admin_remarks) ? (
        <View style={[styles.callout, needsReply ? styles.calloutInfo : styles.calloutDanger]}>
          <CircleAlert size={16} color={needsReply ? colors.info : colors.lost} />
          <Text variant="footnote" numberOfLines={2} style={{ flex: 1 }}>
            {needsReply ? report.admin_remarks || "The admin needs more details." : report.admin_remarks}
          </Text>
          {needsReply ? (
            <Text variant="subhead" color="info">
              Reply
            </Text>
          ) : null}
          <ChevronRight size={16} color={needsReply ? colors.info : colors.textMuted} />
        </View>
      ) : null}
    </Card>
  );
});
ReportCard.displayName = "ReportCard";

export const MyReportsScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const toast = useToast();
  const { user } = useAuth();
  // The students' tab has its own large header; for admins it's a pushed screen
  const isTab = route.name === "Activity";

  const listRef = useRef<FlatList<MyReport>>(null);
  useScrollToTop(listRef);

  const [reports, setReports] = useState<MyReport[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [chooser, setChooser] = useState(false);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    try {
      setReports(await postsApi.getMyReports());
      setError("");
      loaded.current = true;
    } catch (err: any) {
      const message = errorMessage(err, "Couldn't load your reports.");
      if (loaded.current) toast.show(message, "error");
      else setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  // Reload whenever the screen comes back into view, e.g. after renewing or withdrawing
  useFocusEffect(
    useCallback(() => {
      if (user) load();
      else setLoading(false);
    }, [user, load]),
  );

  const counts = useMemo(() => {
    const result: Record<string, number> = { ALL: reports.length };
    reports.forEach((r) => (result[r.status] = (result[r.status] || 0) + 1));
    return result;
  }, [reports]);

  const visible = filter === "ALL" ? reports : reports.filter((r) => r.status === filter);
  const tabs = REPORT_TABS.filter((tab) => tab === "ALL" || counts[tab] || tab === filter);
  const openReport = useCallback(
    (report: MyReport) => navigation.navigate("MyReportDetail", { reportId: report.id, report }),
    [navigation],
  );

  const header = isTab ? (
    <ScreenHeader
      title="My reports"
      subtitle={user && reports.length ? `${reports.length} report${reports.length === 1 ? "" : "s"}` : undefined}
      right={
        user ? (
          <IconButton
            icon={Plus}
            variant="tonal"
            accessibilityLabel="Report an item"
            onPress={() => setChooser(true)}
          />
        ) : null
      }
    />
  ) : null;

  if (!user) {
    return (
      <View style={styles.screen}>
        {header}
        <EmptyState
          icon={LockKeyhole}
          title="Sign in to see your reports"
          body="Follow the reports you've made, answer admin questions and renew listings."
          actionLabel="Sign in"
          onAction={() => navigation.navigate("Auth")}
          style={{ flex: 1 }}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {header}
      {reports.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipBar}
          contentContainerStyle={styles.chips}
        >
          {tabs.map((tab) => (
            <Chip
              key={tab}
              label={tabLabel(tab)}
              count={counts[tab] || 0}
              selected={filter === tab}
              onPress={() => setFilter(tab)}
            />
          ))}
        </ScrollView>
      ) : null}

      {loading ? (
        <View style={styles.list}>
          {[0, 1, 2, 3].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={visible}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ReportCard report={item} onPress={openReport} />}
          contentContainerStyle={styles.list}
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
            error ? (
              <ErrorState
                message={error}
                onRetry={() => {
                  setLoading(true);
                  load();
                }}
              />
            ) : reports.length ? (
              <EmptyState
                icon={ClipboardList}
                tone="neutral"
                compact
                title={`No ${tabLabel(filter).toLowerCase()} reports`}
              />
            ) : (
              <EmptyState
                icon={ClipboardList}
                title="No reports yet"
                body="When you report something you lost or found, you can follow its progress here."
                actionLabel="Report an item"
                onAction={() => setChooser(true)}
              />
            )
          }
        />
      )}
      <ReportChooser visible={chooser} onClose={() => setChooser(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  chipBar: { flexGrow: 0 },
  chips: { gap: 8, paddingHorizontal: SCREEN_PADDING, paddingBottom: 12, paddingTop: 4 },
  list: { paddingHorizontal: SCREEN_PADDING, paddingTop: 4, paddingBottom: 28, flexGrow: 1 },
  card: { marginBottom: 12, padding: 12 },
  cardRow: { flexDirection: "row", gap: 14 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  meta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  callout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    padding: 10,
    borderRadius: radii.sm,
  },
  calloutInfo: { backgroundColor: colors.infoTint },
  calloutDanger: { backgroundColor: colors.lostTint },
});
