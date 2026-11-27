import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import { adminApi, AdminStats } from "../../api/admin";
import { errorMessage } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { colors } from "../../theme/colors";
import { ErrorText, ScreenLoader, Section, formatDateTime, humanize, ui } from "./adminUi";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const MENU: { route: keyof RootStackParamList; emoji: string; label: string; desc: string }[] = [
  { route: "AdminCases", emoji: "🗂️", label: "Case Queue", desc: "Review, approve or reject reports" },
  { route: "AdminMatches", emoji: "🔗", label: "Match Queue", desc: "Confirm matches, verify owners, hand over" },
  { route: "AdminAbuseReports", emoji: "🚩", label: "Abuse Reports", desc: "Reports flagged by students" },
  { route: "AdminUsers", emoji: "👥", label: "User Moderation", desc: "Find students, ban or restore accounts" },
  { route: "AdminInvites", emoji: "✉️", label: "Admin Invites", desc: "Invite another campus admin" },
  { route: "AdminAuditLog", emoji: "🧾", label: "Audit Log", desc: "Every status change and admin action" },
  { route: "AdminFeedback", emoji: "💬", label: "Beta Feedback", desc: "What students say about the app" },
  { route: "AdminSettings", emoji: "⚙️", label: "Site Settings", desc: "Matching, expiry, review SLA, OTP" },
];

const Tile: React.FC<{ label: string; value: number | string; note?: string; tone?: string; onPress?: () => void }> = ({
  label,
  value,
  note,
  tone = colors.textPrimary,
  onPress,
}) => (
  <TouchableOpacity style={styles.tile} activeOpacity={onPress ? 0.8 : 1} onPress={onPress} disabled={!onPress}>
    <Text style={styles.tileLabel}>{label}</Text>
    <Text style={[styles.tileValue, { color: tone }]}>{value}</Text>
    {note ? <Text style={styles.tileNote}>{note}</Text> : null}
  </TouchableOpacity>
);

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
      setError(errorMessage(err, "Failed to load campus statistics."));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (user?.is_staff) load();
    }, [user, load])
  );

  if (!user?.is_staff) {
    return (
      <View style={ui.center}>
        <Text style={ui.emptyTitle}>Admins only</Text>
        <Text style={ui.emptyBody}>Sign in with a campus admin account to open the console.</Text>
      </View>
    );
  }

  const posts = stats?.posts;
  const slaHours = stats?.lifecycle?.review_sla_hours ?? stats?.review_sla_hours ?? 24;
  // Rejected and hidden reports could never be recovered through the portal
  const eligible = posts ? posts.total - posts.rejected - posts.hidden : 0;
  const recovery = posts && eligible > 0 ? Math.round((posts.returned / eligible) * 100) : null;

  return (
    <ScrollView
      style={ui.screen}
      contentContainerStyle={ui.scroll}
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
      <Text style={styles.heading}>Campus Admin Console</Text>
      <Text style={styles.subheading}>Signed in as {user.full_name || user.email}</Text>
      <ErrorText message={error} />

      {!stats && !error ? (
        <View style={{ height: 160 }}>
          <ScreenLoader />
        </View>
      ) : null}

      {posts ? (
        <>
          <View style={styles.tiles}>
            <Tile
              label="Pending review"
              value={posts.pending}
              note={posts.sla_breached ? `${posts.sla_breached} over ${slaHours}h` : `Within ${slaHours}h review window`}
              tone={posts.sla_breached ? colors.lost : colors.textPrimary}
              onPress={() =>
                navigation.navigate("AdminCases", posts.sla_breached ? { slaBreached: true } : { status: "PENDING" })
              }
            />
            <Tile
              label="Active on feed"
              value={posts.approved}
              note={posts.expiring_soon ? `${posts.expiring_soon} expiring soon` : undefined}
              tone={colors.primary}
              onPress={() => navigation.navigate("AdminCases", { status: "APPROVED" })}
            />
            <Tile
              label="Returned"
              value={posts.returned}
              note={recovery !== null ? `${recovery}% recovery rate` : undefined}
              tone={colors.primary}
              onPress={() => navigation.navigate("AdminCases", { status: "RETURNED" })}
            />
            <Tile
              label="Abuse reports"
              value={stats?.abuse_reports?.pending ?? 0}
              note="Waiting for review"
              tone={stats?.abuse_reports?.pending ? colors.lost : colors.textPrimary}
              onPress={() => navigation.navigate("AdminAbuseReports")}
            />
          </View>

          <Section title="Reports">
            <Text style={ui.meta}>
              {posts.total} total · {posts.lost} lost · {posts.found} found · {posts.info_requested} awaiting info ·{" "}
              {posts.expired} expired · {posts.rejected} rejected · {posts.hidden} hidden
            </Text>
            <Text style={ui.meta}>
              {stats?.users?.students ?? 0} students · {stats?.users?.new_this_week ?? 0} joined this week ·{" "}
              {stats?.users?.banned ?? 0} banned
            </Text>
          </Section>
        </>
      ) : null}

      <View style={styles.menu}>
        {MENU.map((item) => (
          <TouchableOpacity
            key={item.route}
            style={styles.menuItem}
            activeOpacity={0.8}
            onPress={() => navigation.navigate(item.route as any)}
          >
            <Text style={styles.menuEmoji}>{item.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.menuDesc}>{item.desc}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {stats?.recent_activity?.length ? (
        <Section title="Recent activity">
          {stats.recent_activity.slice(0, 6).map((entry) => (
            <View key={entry.id} style={styles.activity}>
              <Text style={styles.activityTitle} numberOfLines={1}>
                {humanize(entry.action)} · {entry.post_title || "Deleted report"}
              </Text>
              <Text style={ui.muted}>
                {entry.admin_email || "Automatic"} · {formatDateTime(entry.created_at)}
              </Text>
            </View>
          ))}
        </Section>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  heading: { fontSize: 22, fontWeight: "800", color: colors.textPrimary },
  subheading: { fontSize: 12, color: colors.textSecondary, marginBottom: 12 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  tile: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 14,
  },
  tileLabel: { fontSize: 11, fontWeight: "700", color: colors.textSecondary, textTransform: "uppercase" },
  tileValue: { fontSize: 28, fontWeight: "800", marginVertical: 4 },
  tileNote: { fontSize: 11, color: colors.textSecondary },
  menu: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 12,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  menuEmoji: { fontSize: 20 },
  menuLabel: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  menuDesc: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  chevron: { fontSize: 22, color: colors.textMuted },
  activity: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  activityTitle: { fontSize: 12, fontWeight: "600", color: colors.textPrimary },
});
