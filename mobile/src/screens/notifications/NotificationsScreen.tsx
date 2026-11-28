import React, { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import { NotificationItem, notificationsApi } from "../../api/notifications";
import { errorMessage } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useActivity } from "../../context/ActivityContext";
import { EmptyState, ErrorState, RowSkeleton, Text, useToast } from "../../ui";
import {
  BadgeCheck,
  Bell,
  BellRing,
  CheckCheck,
  CircleAlert,
  CircleX,
  Flag,
  Gift,
  Handshake,
  Hourglass,
  IconType,
  MessageCircle,
  QrCode,
  Sparkles,
  Timer,
} from "../../ui/icons";
import { colors } from "../../theme/colors";
import { radii, SCREEN_PADDING } from "../../theme/tokens";
import { timeAgo } from "../../utils/format";

type Props = NativeStackScreenProps<RootStackParamList, "Notifications">;

const LOOKS: Record<string, { icon: IconType; fg: string; bg: string }> = {
  post_approved: { icon: BadgeCheck, fg: colors.primary, bg: colors.primaryTint },
  post_rejected: { icon: CircleX, fg: colors.lost, bg: colors.lostTint },
  info_requested: { icon: CircleAlert, fg: colors.info, bg: colors.infoTint },
  match_found: { icon: Sparkles, fg: colors.primary, bg: colors.primarySoft },
  handover_ready: { icon: Handshake, fg: colors.primary, bg: colors.primaryTint },
  reward_recorded: { icon: Gift, fg: colors.reward, bg: colors.rewardTint },
  post_expiring: { icon: Hourglass, fg: colors.warning, bg: colors.warningTint },
  post_expired: { icon: Hourglass, fg: colors.textSecondary, bg: colors.surfaceAlt },
  review_overdue: { icon: Timer, fg: colors.lost, bg: colors.lostTint },
  chat_message: { icon: MessageCircle, fg: colors.info, bg: colors.infoTint },
};

function lookFor(n: NotificationItem) {
  if (LOOKS[n.notification_type]) return LOOKS[n.notification_type];
  const data = n.data || {};
  if (data.event === "sticker_scanned" || data.item_id) return { icon: QrCode, fg: colors.info, bg: colors.infoTint };
  if (data.abuse_report_id) return { icon: Flag, fg: colors.lost, bg: colors.lostTint };
  return { icon: Bell, fg: colors.textSecondary, bg: colors.surfaceAlt };
}

type Row = { kind: "header"; key: string; title: string } | { kind: "item"; key: string; item: NotificationItem };

const NotificationRow = memo<{ item: NotificationItem; onPress: (n: NotificationItem) => void }>(
  ({ item, onPress }) => {
    const look = lookFor(item);
    const Icon = look.icon;
    return (
      <Pressable
        onPress={() => onPress(item)}
        style={({ pressed }) => [styles.row, !item.is_read && styles.rowUnread, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
        accessibilityLabel={`${item.is_read ? "" : "Unread. "}${item.title}. ${item.message}`}
      >
        <View style={[styles.icon, { backgroundColor: look.bg }]}>
          <Icon size={20} color={look.fg} strokeWidth={2} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={styles.rowTop}>
            <Text variant={item.is_read ? "bodyMedium" : "headline"} numberOfLines={2} style={{ flex: 1 }}>
              {item.title}
            </Text>
            {!item.is_read ? <View style={styles.dot} /> : null}
          </View>
          {item.message ? (
            <Text variant="footnote" color="textSecondary" numberOfLines={3}>
              {item.message}
            </Text>
          ) : null}
          <Text variant="caption" color="textMuted" style={{ marginTop: 2 }}>
            {timeAgo(item.created_at)}
          </Text>
        </View>
      </Pressable>
    );
  },
);
NotificationRow.displayName = "NotificationRow";

export const NotificationsScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const toast = useToast();
  const { setUnreadNotifications, refresh: refreshBadges } = useActivity();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const loaded = useRef(false);

  const unread = items.filter((n) => !n.is_read).length;

  const load = useCallback(async () => {
    try {
      const data = await notificationsApi.getNotifications();
      setItems(data);
      setUnreadNotifications(data.filter((n) => !n.is_read).length);
      setError("");
      loaded.current = true;
    } catch (err: any) {
      const message = errorMessage(err, "Couldn't load notifications.");
      if (loaded.current) toast.show(message, "error");
      else setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setUnreadNotifications, toast]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const markAllRead = useCallback(async () => {
    const before = items;
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadNotifications(0);
    try {
      await notificationsApi.markAllRead();
    } catch (err: any) {
      setItems(before);
      refreshBadges();
      toast.show(errorMessage(err, "Couldn't mark them as read."), "error");
    }
  }, [items, refreshBadges, setUnreadNotifications, toast]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: unread
        ? () => (
            <Pressable onPress={markAllRead} hitSlop={10} style={styles.headerAction} accessibilityRole="button">
              <CheckCheck size={18} color={colors.primary} />
              <Text variant="subhead" color="primary">
                Mark all read
              </Text>
            </Pressable>
          )
        : undefined,
    });
  }, [navigation, unread, markAllRead]);

  const open = useCallback(
    (n: NotificationItem) => {
      if (!n.is_read) {
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
        setUnreadNotifications(Math.max(0, unread - 1));
        notificationsApi.markRead(n.id).catch(() => {});
      }
      const data = n.data || {};
      const url = n.action_url || "";
      const staff = !!user?.is_staff;

      if (data.event === "possible_match" && data.found_post_id) {
        navigation.navigate("ItemDetail", { postId: data.found_post_id });
      } else if (data.conversation_id) {
        navigation.navigate("Chat", { conversationId: data.conversation_id });
      } else if (n.notification_type === "chat_message" || url.startsWith("/chat")) {
        navigation.navigate("Main", { screen: "Inbox" });
      } else if (staff && data.abuse_report_id) {
        navigation.navigate("AdminAbuseReports");
      } else if (staff && n.notification_type === "review_overdue") {
        navigation.navigate("AdminCases", { slaBreached: true });
      } else if (staff && url.startsWith("/admin") && data.post_id) {
        navigation.navigate("AdminCaseDetail", { postId: data.post_id });
      } else if (data.item_id) {
        // About a registered item: its sticker was scanned, or someone reported finding it
        // (that report isn't the user's own, so the conversation is the place to follow up)
        if (data.event === "sticker_scanned") navigation.navigate("Valuables");
        else navigation.navigate("Main", { screen: "Inbox" });
      } else if (data.post_id) {
        navigation.navigate("MyReportDetail", { reportId: data.post_id });
      } else if (url.startsWith("/my-reports")) {
        if (staff) navigation.navigate("MyReports");
        else navigation.navigate("Main", { screen: "Activity" });
      }
    },
    [navigation, setUnreadNotifications, unread, user?.is_staff],
  );

  const rows = useMemo<Row[]>(() => {
    const fresh = items.filter((n) => !n.is_read);
    const earlier = items.filter((n) => n.is_read);
    const out: Row[] = [];
    if (fresh.length) {
      out.push({ kind: "header", key: "h-new", title: "New" });
      fresh.forEach((item) => out.push({ kind: "item", key: item.id, item }));
    }
    if (earlier.length) {
      out.push({ kind: "header", key: "h-earlier", title: fresh.length ? "Earlier" : "All notifications" });
      earlier.forEach((item) => out.push({ kind: "item", key: item.id, item }));
    }
    return out;
  }, [items]);

  if (loading) {
    return (
      <View style={[styles.screen, { paddingHorizontal: SCREEN_PADDING, paddingTop: 8 }]}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <RowSkeleton key={i} />
        ))}
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      data={rows}
      keyExtractor={(row) => row.key}
      renderItem={({ item: row }) =>
        row.kind === "header" ? (
          <Text variant="overline" color="textSecondary" style={styles.section}>
            {row.title}
          </Text>
        ) : (
          <NotificationRow item={row.item} onPress={open} />
        )
      }
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
        ) : (
          <EmptyState
            icon={BellRing}
            title="You're all caught up"
            body="Updates about your reports, possible matches and messages will appear here."
          />
        )
      }
    />
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: SCREEN_PADDING, paddingBottom: 32, flexGrow: 1 },
  section: { marginTop: 14, marginBottom: 8, marginLeft: 4 },
  row: {
    flexDirection: "row",
    gap: 14,
    padding: 14,
    marginBottom: 8,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowUnread: { borderColor: colors.primarySoft, backgroundColor: "#FBFEFC" },
  rowTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  icon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary, marginTop: 6 },
  headerAction: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 4 },
});
