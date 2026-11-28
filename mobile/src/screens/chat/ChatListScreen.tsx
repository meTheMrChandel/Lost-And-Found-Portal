import React, { memo, useCallback, useMemo, useRef, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation, useScrollToTop } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import { chatApi, Conversation } from "../../api/chat";
import { errorMessage } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useActivity } from "../../context/ActivityContext";
import {
  Avatar,
  Badge,
  EmptyState,
  ErrorState,
  IconButton,
  PressableScale,
  RowSkeleton,
  ScreenHeader,
  Text,
  useToast,
} from "../../ui";
import { ChevronRight, LockKeyhole, MessageCircle, MessageSquarePlus, ShieldCheck } from "../../ui/icons";
import { colors } from "../../theme/colors";
import { radii, SCREEN_PADDING } from "../../theme/tokens";
import { listStamp } from "../../utils/format";
import { conversationNote, conversationTitle, isAdminThread, lastActivity } from "./conversationLabel";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const ConversationRow = memo<{
  conv: Conversation;
  myId: string;
  isStaff: boolean;
  onPress: (conv: Conversation, title: string) => void;
}>(({ conv, myId, isStaff, onPress }) => {
  const title = conversationTitle(conv, myId, isStaff);
  const unread = conv.unread_count > 0;
  const waitingOnMe = conv.request_status === "pending" && conv.requested_by !== myId;
  const adminThread = isAdminThread(conv) && !isStaff;
  return (
    <PressableScale onPress={() => onPress(conv, title)} scaleTo={0.985} style={styles.row} accessibilityRole="button">
      <Avatar name={title} icon={adminThread ? ShieldCheck : undefined} size={50} />
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text variant="headline" numberOfLines={1} style={{ flex: 1 }}>
            {title}
          </Text>
          <Text variant="caption" color={unread ? "primary" : "textMuted"}>
            {listStamp(lastActivity(conv))}
          </Text>
        </View>
        <View style={styles.rowBottom}>
          {waitingOnMe ? <Badge label="Request" tone="info" /> : null}
          <Text
            variant="footnote"
            color={unread || waitingOnMe ? "textPrimary" : "textSecondary"}
            numberOfLines={1}
            style={[{ flex: 1 }, unread && { fontWeight: "600" }]}
          >
            {conversationNote(conv, myId)}
          </Text>
          {unread ? (
            <View style={styles.unread}>
              <Text style={styles.unreadText}>{conv.unread_count > 99 ? "99+" : conv.unread_count}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
});
ConversationRow.displayName = "ConversationRow";

export const ChatListScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const toast = useToast();
  const { user } = useAuth();
  const { refresh: refreshBadges } = useActivity();

  const listRef = useRef<FlatList<Conversation>>(null);
  useScrollToTop(listRef);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [openingAdmin, setOpeningAdmin] = useState(false);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    try {
      setConversations(await chatApi.getConversations());
      setError("");
      loaded.current = true;
    } catch (err: any) {
      const message = errorMessage(err, "Couldn't load your messages.");
      if (loaded.current) toast.show(message, "error");
      else setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        load();
        refreshBadges();
      } else setLoading(false);
    }, [user, load, refreshBadges]),
  );

  const sorted = useMemo(
    () => [...conversations].sort((a, b) => lastActivity(b).localeCompare(lastActivity(a))),
    [conversations],
  );
  const hasAdminThread = conversations.some(isAdminThread);

  const open = useCallback(
    (conv: Conversation, title: string) => navigation.navigate("Chat", { conversationId: conv.id, title }),
    [navigation],
  );

  const openAdminOffice = async () => {
    setOpeningAdmin(true);
    try {
      const conv = await chatApi.openAdminConversation();
      navigation.navigate("Chat", { conversationId: conv.id, title: "Admin office" });
    } catch (err: any) {
      toast.show(errorMessage(err, "Couldn't open the chat."), "error");
    } finally {
      setOpeningAdmin(false);
    }
  };

  const header = (
    <ScreenHeader
      title="Messages"
      right={
        user ? (
          <IconButton
            icon={MessageSquarePlus}
            variant="tonal"
            accessibilityLabel="New message"
            onPress={() => navigation.navigate("NewMessage")}
          />
        ) : null
      }
    />
  );

  if (!user) {
    return (
      <View style={styles.screen}>
        {header}
        <EmptyState
          icon={LockKeyhole}
          title="Sign in to see your messages"
          body="Chat with the admin office about a claim, or with the owner of an item you found."
          actionLabel="Sign in"
          onAction={() => navigation.navigate("Auth")}
          style={{ flex: 1 }}
        />
      </View>
    );
  }

  const adminShortcut =
    !user.is_staff && !hasAdminThread && !loading ? (
      <PressableScale onPress={openAdminOffice} disabled={openingAdmin} scaleTo={0.985} style={styles.shortcut}>
        <Avatar name="Admin office" icon={ShieldCheck} size={44} />
        <View style={{ flex: 1 }}>
          <Text variant="headline">Message the admin office</Text>
          <Text variant="footnote" color="textSecondary">
            Ask about a claim, a hand-over or your report
          </Text>
        </View>
        <ChevronRight size={18} color={colors.textMuted} />
      </PressableScale>
    ) : undefined;

  return (
    <View style={styles.screen}>
      {header}
      {loading ? (
        <View style={{ paddingHorizontal: SCREEN_PADDING }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <RowSkeleton key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={sorted}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ConversationRow conv={item} myId={user.id} isStaff={!!user.is_staff} onPress={open} />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListHeaderComponent={adminShortcut}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
                refreshBadges();
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
                icon={MessageCircle}
                title="No conversations yet"
                body="Know who an item belongs to? Message them with their registration number."
                actionLabel="New message"
                onAction={() => navigation.navigate("NewMessage")}
                compact={!!adminShortcut}
              />
            )
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  list: { paddingBottom: 28, flexGrow: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 12,
    backgroundColor: colors.background,
  },
  rowBody: { flex: 1, minWidth: 0, gap: 3 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  rowBottom: { flexDirection: "row", alignItems: "center", gap: 8 },
  unread: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadText: { color: colors.textWhite, fontSize: 11, lineHeight: 13, fontWeight: "700" },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: SCREEN_PADDING + 64 },
  shortcut: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginHorizontal: SCREEN_PADDING,
    marginBottom: 8,
    padding: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
});
