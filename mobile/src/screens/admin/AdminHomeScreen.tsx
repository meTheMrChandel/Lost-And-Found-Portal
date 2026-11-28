import React, { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import { adminApi, AdminStats } from "../../api/admin";
import { errorMessage } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import {
  EmptyState,
  ListGroup,
  ListItem,
  Notice,
  PressableScale,
  ScreenHeader,
  SectionHeader,
  Skeleton,
  Text,
} from "../../ui";
import {
  BadgeCheck,
  ClipboardCheck,
  Flag,
  Handshake,
  History,
  Hourglass,
  IconType,
  Link2,
  MailPlus,
  MessageSquareText,
  Settings,
  ShieldCheck,
  Users,
} from "../../ui/icons";
import { colors } from "../../theme/colors";
import { radii, SCREEN_PADDING } from "../../theme/tokens";
import { humanize, timeAgo } from "../../utils/format";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const MENU: { route: keyof RootStackParamList; icon: IconType; label: string; desc: string }[] = [
  { route: "AdminCases", icon: ClipboardCheck, label: "Case queue", desc: "Review, approve or reject reports" },
  { route: "AdminMatches", icon: Link2, label: "Match queue", desc: "Confirm matches, verify owners, hand over" },
  { route: "AdminAbuseReports", icon: Flag, label: "Abuse reports", desc: "Listings flagged by students" },
  { route: "AdminUsers", icon: Users, label: "Users", desc: "Find students, ban or restore accounts" },
  { route: "AdminInvites", icon: MailPlus, label: "Admin invites", desc: "Invite another campus admin" },
  { route: "AdminAuditLog", icon: History, label: "Audit log", desc: "Every status change and admin action" },
  { route: "AdminFeedback", icon: MessageSquareText, label: "App feedback", desc: "What students say about the app" },
  { route: "AdminSettings", icon: Settings, label: "Site settings", desc: "Matching, expiry and review deadlines" },
];

const Tile: React.FC<{
  label: string;
  value: number | string;
  note?: string;
  icon: IconType;
  tone: { fg: string; bg: string };
  onPress?: () => void;
}> = ({ label, value, note, icon: Icon, tone, onPress }) => (
  <PressableScale onPress={onPress} disabled={!onPress} scaleTo={0.97} style={styles.tile} accessibilityRole="button">
    <View style={[styles.tileIcon, { backgroundColor: tone.bg }]}>
      <Icon size={18} color={tone.fg} strokeWidth={2.2} />
    </View>
    <Text
      variant="title1"
      style={{ color: tone.fg === colors.textSecondary ? colors.textPrimary : tone.fg, marginTop: 12 }}
    >
      {value}
    </Text>
    <Text variant="subhead">{label}</Text>
    {note ? (
      <Text variant="caption" color="textSecondary" numberOfLines={1} style={{ marginTop: 2 }}>
        {note}
      </Text>
    ) : null}
  </PressableScale>
);

const TONES = {
  neutral: { fg: colors.textSecondary, bg: colors.surfaceAlt },
  good: { fg: colors.primary, bg: colors.primaryTint },
  warn: { fg: colors.warning, bg: colors.warningTint },
  bad: { fg: colors.lost, bg: colors.lostTint },
};

export const AdminHomeScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setStats(await adminApi.getStatistics());
      setError("");
    } catch (err: any) {
      setError(errorMessage(err, "Couldn't load campus statistics."));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (user?.is_staff) load();
    }, [user, load]),
  );

  if (!user?.is_staff) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Admin" />
        <EmptyState
          icon={ShieldCheck}
          title="Admins only"
          body="Sign in with a campus admin account to open the console."
        />
      </View>
    );
  }

  const posts = stats?.posts;
  const slaHours = stats?.lifecycle?.review_sla_hours ?? stats?.review_sla_hours ?? 24;
  // Rejected and hidden reports could never be recovered through the portal
  const eligible = posts ? posts.total - posts.rejected - posts.hidden : 0;
  const recovery = posts && eligible > 0 ? Math.round((posts.returned / eligible) * 100) : null;
  const abuse = stats?.abuse_reports?.pending ?? 0;

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Admin" subtitle={`Signed in as ${user.full_name || user.email}`} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
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
      >
        {error ? (
          <Notice tone="danger" message={error} actionLabel="Try again" onAction={load} style={{ marginBottom: 14 }} />
        ) : null}

        {posts ? (
          <View style={styles.grid}>
            <Tile
              label="Pending review"
              value={posts.pending}
              icon={Hourglass}
              tone={posts.sla_breached ? TONES.bad : posts.pending ? TONES.warn : TONES.neutral}
              note={posts.sla_breached ? `${posts.sla_breached} over ${slaHours}h` : `${slaHours}h review window`}
              onPress={() =>
                navigation.navigate("AdminCases", posts.sla_breached ? { slaBreached: true } : { status: "PENDING" })
              }
            />
            <Tile
              label="Live on feed"
              value={posts.approved}
              icon={BadgeCheck}
              tone={TONES.good}
              note={posts.expiring_soon ? `${posts.expiring_soon} expiring soon` : "Active reports"}
              onPress={() => navigation.navigate("AdminCases", { status: "APPROVED" })}
            />
            <Tile
              label="Returned"
              value={posts.returned}
              icon={Handshake}
              tone={TONES.good}
              note={recovery !== null ? `${recovery}% recovery rate` : "Items handed over"}
              onPress={() => navigation.navigate("AdminCases", { status: "RETURNED" })}
            />
            <Tile
              label="Abuse reports"
              value={abuse}
              icon={Flag}
              tone={abuse ? TONES.bad : TONES.neutral}
              note="Waiting for review"
              onPress={() => navigation.navigate("AdminAbuseReports")}
            />
          </View>
        ) : !error ? (
          <View style={styles.grid}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.tile, { gap: 10 }]}>
                <Skeleton width={34} height={34} radius={10} />
                <Skeleton width={50} height={26} />
                <Skeleton width="70%" height={12} />
              </View>
            ))}
          </View>
        ) : null}

        {posts ? (
          <View style={styles.summary}>
            <Text variant="footnote" color="textSecondary">
              {posts.total} reports · {posts.lost} lost · {posts.found} found · {posts.info_requested} awaiting info ·{" "}
              {posts.expired} expired · {posts.rejected} rejected · {posts.hidden} hidden
            </Text>
            <Text variant="footnote" color="textSecondary" style={{ marginTop: 4 }}>
              {stats?.users?.students ?? 0} students · {stats?.users?.new_this_week ?? 0} joined this week ·{" "}
              {stats?.users?.banned ?? 0} banned
            </Text>
          </View>
        ) : null}

        <SectionHeader title="Manage" style={{ marginTop: 22 }} />
        <ListGroup>
          {MENU.map((item) => (
            <ListItem
              key={item.route}
              title={item.label}
              subtitle={item.desc}
              icon={item.icon}
              badge={
                item.route === "AdminAbuseReports"
                  ? abuse
                  : item.route === "AdminCases"
                    ? posts?.sla_breached
                    : undefined
              }
              onPress={() => navigation.navigate(item.route as any)}
            />
          ))}
        </ListGroup>

        {stats?.recent_activity?.length ? (
          <>
            <SectionHeader title="Recent activity" style={{ marginTop: 22 }} />
            <View style={styles.activity}>
              {stats.recent_activity.slice(0, 6).map((entry, i, all) => (
                <View key={entry.id} style={styles.activityRow}>
                  <View style={styles.timeline}>
                    <View style={styles.timelineDot} />
                    {i < all.length - 1 ? <View style={styles.timelineLine} /> : null}
                  </View>
                  <View style={{ flex: 1, paddingBottom: 14 }}>
                    <Text variant="calloutMedium" numberOfLines={1}>
                      {humanize(entry.action)} · {entry.post_title || "Deleted report"}
                    </Text>
                    <Text variant="caption" color="textMuted">
                      {entry.admin_email ? entry.admin_email.split("@")[0] : "Automatic"} · {timeAgo(entry.created_at)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: SCREEN_PADDING, paddingBottom: 32 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: {
    flexBasis: "47%",
    flexGrow: 1,
    padding: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tileIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  summary: {
    marginTop: 12,
    padding: 14,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
  },
  activity: {
    paddingHorizontal: 16,
    paddingTop: 16,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  activityRow: { flexDirection: "row", gap: 12 },
  timeline: { width: 12, alignItems: "center" },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginTop: 5 },
  timelineLine: { flex: 1, width: 2, backgroundColor: colors.border, marginTop: 4 },
});
