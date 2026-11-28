import React, { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { HeaderHeightContext } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RootStackParamList } from "../../navigation/types";
import { chatApi, ChatMessage, Conversation } from "../../api/chat";
import { errorMessage, storage, websocketUrl } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useActivity } from "../../context/ActivityContext";
import {
  Avatar,
  Button,
  ErrorState,
  IconButton,
  Notice,
  OptionSheet,
  Skeleton,
  Text,
  TextInput,
  useKeyboardVisible,
  useToast,
} from "../../ui";
import {
  Ban,
  Check,
  CheckCheck,
  Clock,
  EllipsisVertical,
  MessageCircle,
  Send,
  ShieldCheck,
  WifiOff,
} from "../../ui/icons";
import { colors } from "../../theme/colors";
import { radii } from "../../theme/tokens";
import { dayLabel, formatTime } from "../../utils/format";
import { conversationTitle, isAdminThread, otherParticipant } from "./conversationLabel";

type Props = NativeStackScreenProps<RootStackParamList, "Chat">;

interface PendingMessage {
  tempId: string;
  content: string;
  created_at: string;
}

type Row =
  | { kind: "day"; key: string; label: string }
  | {
      kind: "message";
      key: string;
      message: ChatMessage;
      mine: boolean;
      first: boolean;
      last: boolean;
      pending: boolean;
    };

const GROUP_GAP_MS = 5 * 60_000;

function sameGroup(a?: ChatMessage, b?: ChatMessage): boolean {
  if (!a || !b || a.sender_id !== b.sender_id) return false;
  const gap = Math.abs(new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return gap < GROUP_GAP_MS && new Date(a.created_at).toDateString() === new Date(b.created_at).toDateString();
}

const HeaderTitle: React.FC<{ name: string; subtitle?: string; admin: boolean }> = ({ name, subtitle, admin }) => (
  <View style={styles.headerTitle}>
    <Avatar name={name} icon={admin ? ShieldCheck : undefined} size={34} />
    <View style={{ flexShrink: 1 }}>
      <Text variant="headline" numberOfLines={1}>
        {name}
      </Text>
      {subtitle ? (
        <Text variant="caption" color="textSecondary" numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  </View>
);

export const ChatScreen: React.FC<Props> = ({ route, navigation }) => {
  const { conversationId, title, draft } = route.params;
  const { user } = useAuth();
  const { refresh: refreshBadges } = useActivity();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const headerHeight = useContext(HeaderHeightContext) ?? 0;
  const keyboardUp = useKeyboardVisible();

  const [conv, setConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [inputText, setInputText] = useState(draft || "");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [offline, setOffline] = useState(false);
  const [responding, setResponding] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  // Newest message we hold, so a reconnect only fetches what was missed
  const lastSyncRef = useRef<string | null>(null);
  const userIdRef = useRef(user?.id);
  userIdRef.current = user?.id;

  const addMessages = useCallback((incoming: ChatMessage[]) => {
    if (incoming.length === 0) return;
    setMessages((prev) => {
      const known = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !known.has(m.id));
      return fresh.length ? [...prev, ...fresh] : prev;
    });
    // The server's copy of something we sent replaces its "sending" placeholder
    const mine = incoming.filter((m) => m.sender_id === userIdRef.current);
    if (mine.length) {
      setPending((prev) => {
        let next = prev;
        mine.forEach((m) => {
          const i = next.findIndex((p) => p.content === m.content);
          if (i >= 0) next = [...next.slice(0, i), ...next.slice(i + 1)];
        });
        return next;
      });
    }
    const newest = incoming[incoming.length - 1].created_at;
    if (!lastSyncRef.current || newest > lastSyncRef.current) lastSyncRef.current = newest;
  }, []);

  // The recipient writing back means the request was accepted
  const markAcceptedIfReply = useCallback((senderId: string) => {
    setConv((c) =>
      c && c.request_status === "pending" && senderId !== c.requested_by ? { ...c, request_status: "accepted" } : c,
    );
  }, []);

  useEffect(() => {
    let closedByUs = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = 2000;

    // REST sync: everything on first load, then only messages since the last one we hold
    const sync = async () => {
      try {
        const data = await chatApi.getMessages(conversationId, lastSyncRef.current || undefined);
        if (closedByUs) return;
        if (lastSyncRef.current) addMessages(data);
        else {
          setMessages(data);
          if (data.length) lastSyncRef.current = data[data.length - 1].created_at;
        }
        setLoadError("");
        await chatApi.markRead(conversationId);
        refreshBadges();
      } catch (err: any) {
        if (!closedByUs && !lastSyncRef.current) setLoadError(errorMessage(err, "Couldn't load messages."));
      } finally {
        if (!closedByUs) setLoading(false);
      }
    };

    const connect = async () => {
      // Read the token each time: the REST sync may have refreshed it
      const token = await storage.getItem("access_token");
      if (closedByUs || !token) return;
      const socket = new WebSocket(websocketUrl(`/ws/chat/${conversationId}/?token=${encodeURIComponent(token)}`));
      socketRef.current = socket;

      socket.onopen = () => {
        retryDelay = 2000;
        setOffline(false);
        socket.send(JSON.stringify({ action: "mark_read" }));
      };

      socket.onmessage = (event) => {
        let payload: any;
        try {
          payload = JSON.parse(event.data);
        } catch {
          return;
        }
        if (payload.type === "chat_message" && payload.message) {
          const m = payload.message;
          const isMe = m.sender_id === userIdRef.current;
          addMessages([
            {
              id: m.id,
              conversation: m.conversation_id || conversationId,
              sender_id: m.sender_id,
              sender: {
                id: m.sender_id,
                full_name: m.sender_name || "Campus member",
                email: "",
                registration_number: "",
              },
              content: m.content,
              is_read: !!m.is_read,
              is_me: isMe,
              created_at: m.created_at || new Date().toISOString(),
            },
          ]);
          if (!isMe) socket.send(JSON.stringify({ action: "mark_read" }));
          markAcceptedIfReply(m.sender_id);
        } else if (payload.type === "read_receipt" && payload.reader_id !== userIdRef.current) {
          setMessages((prev) =>
            prev.map((m) => (m.is_me || m.sender_id === userIdRef.current ? { ...m, is_read: true } : m)),
          );
        } else if (payload.type === "error" && payload.error) {
          toast.show(String(payload.error), "error");
        }
      };

      socket.onclose = (event) => {
        if (socketRef.current === socket) socketRef.current = null;
        // 4403: not a participant of this conversation, retrying won't help
        if (closedByUs || event.code === 4403) return;
        setOffline(true);
        retryTimer = setTimeout(async () => {
          await sync(); // catch up on anything missed, refreshing the token if it expired
          connect();
        }, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 30000);
      };
    };

    chatApi
      .getConversation(conversationId)
      .then((c) => {
        if (!closedByUs) setConv(c);
      })
      .catch(() => {});
    sync().then(connect);

    return () => {
      closedByUs = true;
      if (retryTimer) clearTimeout(retryTimer);
      socketRef.current?.close();
      socketRef.current = null;
      lastSyncRef.current = null;
    };
  }, [conversationId, addMessages, markAcceptedIfReply, refreshBadges, toast]);

  const isStaff = !!user?.is_staff;
  const adminThread = !!conv && isAdminThread(conv);
  const other = conv ? otherParticipant(conv, user?.id) : undefined;
  const name = conv ? conversationTitle(conv, user?.id, isStaff) : title || "Conversation";
  const subtitle = adminThread
    ? isStaff
      ? other?.registration_number || "Student"
      : "Campus admin office"
    : other?.registration_number;
  const isStudentChat = conv?.conversation_type === "student";

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => <HeaderTitle name={name} subtitle={subtitle} admin={adminThread && !isStaff} />,
      headerRight: isStudentChat
        ? () => (
            <IconButton
              icon={EllipsisVertical}
              accessibilityLabel="More options"
              onPress={() => setMenuOpen(true)}
              size={40}
            />
          )
        : undefined,
    });
  }, [navigation, name, subtitle, adminThread, isStaff, isStudentChat]);

  const rows = useMemo<Row[]>(() => {
    const myId = user?.id;
    const all: { message: ChatMessage; pending: boolean }[] = [
      ...messages.map((m) => ({ message: m, pending: false })),
      ...pending.map((p) => ({
        pending: true,
        message: {
          id: p.tempId,
          conversation: conversationId,
          sender_id: myId || "me",
          sender: { id: myId || "me", full_name: "", registration_number: "" },
          content: p.content,
          is_read: false,
          is_me: true,
          created_at: p.created_at,
        } as ChatMessage,
      })),
    ];
    const out: Row[] = [];
    let lastDay = "";
    all.forEach(({ message, pending: isPending }, i) => {
      const day = new Date(message.created_at).toDateString();
      if (day !== lastDay) {
        out.push({ kind: "day", key: `day-${day}`, label: dayLabel(message.created_at) });
        lastDay = day;
      }
      out.push({
        kind: "message",
        key: message.id,
        message,
        mine: message.is_me || message.sender_id === myId,
        first: !sameGroup(all[i - 1]?.message, message),
        last: !sameGroup(message, all[i + 1]?.message),
        pending: isPending,
      });
    });
    // The list is inverted so it opens at the newest message
    return out.reverse();
  }, [messages, pending, user?.id, conversationId]);

  const respond = async (action: "accept" | "decline") => {
    setResponding(true);
    try {
      setConv(await chatApi.respondToRequest(conversationId, action));
      if (action === "decline") toast.show("Request declined");
    } catch (err: any) {
      toast.show(errorMessage(err, "Couldn't answer the request."), "error");
    } finally {
      setResponding(false);
    }
  };

  const block = async () => {
    if (!other) return;
    try {
      const res = await chatApi.toggleBlock(other.id);
      toast.show(res.message || `${other.full_name} is blocked`);
      navigation.goBack();
    } catch (err: any) {
      toast.show(errorMessage(err, "Couldn't block them."), "error");
    }
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text) return;
    setInputText("");
    const tempId = `pending-${Date.now()}`;
    setPending((prev) => [...prev, { tempId, content: text, created_at: new Date().toISOString() }]);

    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      // The server broadcasts it back to us, which replaces the placeholder
      socket.send(JSON.stringify({ action: "send_message", content: text }));
      return;
    }
    // No live connection: fall back to REST
    try {
      const sent = await chatApi.sendMessage(conversationId, text);
      setPending((prev) => prev.filter((p) => p.tempId !== tempId));
      addMessages([sent]);
      if (user) markAcceptedIfReply(user.id);
    } catch (err: any) {
      setPending((prev) => prev.filter((p) => p.tempId !== tempId));
      setInputText((current) => current || text);
      toast.show(errorMessage(err, "Message not sent. Please try again."), "error");
    }
  };

  const requestPending = conv?.request_status === "pending";
  const iAskedForIt = !!conv && conv.requested_by === user?.id;
  const declined = isStudentChat && conv?.request_status === "declined";
  // The requester's one message is already sent; the recipient answers with the buttons or by replying
  const canType = !declined && !(isStudentChat && requestPending && iAskedForIt);

  const renderRow = ({ item }: { item: Row }) => {
    if (item.kind === "day") {
      return (
        <View style={styles.day}>
          <Text variant="caption" color="textSecondary" style={styles.dayText}>
            {item.label}
          </Text>
        </View>
      );
    }
    const { message, mine, first, last } = item;
    const showName = !mine && first && !isStudentChat && message.sender?.full_name;
    return (
      <View style={[styles.messageRow, mine ? styles.rowMine : styles.rowTheirs, last ? styles.groupEnd : null]}>
        {showName ? (
          <Text variant="caption" color="textSecondary" style={styles.sender}>
            {message.sender.full_name}
          </Text>
        ) : null}
        <View
          style={[
            styles.bubble,
            mine ? styles.bubbleMine : styles.bubbleTheirs,
            last && (mine ? styles.tailMine : styles.tailTheirs),
            item.pending && { opacity: 0.7 },
          ]}
        >
          <Text style={[styles.messageText, { color: mine ? colors.textWhite : colors.textPrimary }]}>
            {message.content}
          </Text>
          <View style={styles.meta}>
            <Text style={[styles.time, { color: mine ? "rgba(255,255,255,0.75)" : colors.textMuted }]}>
              {formatTime(message.created_at)}
            </Text>
            {mine ? (
              item.pending ? (
                <Clock size={12} color="rgba(255,255,255,0.75)" />
              ) : message.is_read ? (
                <CheckCheck size={14} color="#A7F3D0" strokeWidth={2.4} />
              ) : (
                <Check size={14} color="rgba(255,255,255,0.75)" strokeWidth={2.4} />
              )
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  const banner =
    adminThread && !isStaff ? (
      <Notice
        tone="neutral"
        icon={ShieldCheck}
        message="Messages here go to the campus admin office. They verify ownership before anything is handed over."
        style={styles.banner}
      />
    ) : conv?.item ? (
      <Notice
        tone="info"
        message={`${conv.item.owner_id === user?.id ? `About your ${conv.item.name}` : `About ${conv.item.name}`}, started from its QR sticker.`}
        style={styles.banner}
      />
    ) : undefined;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="padding" keyboardVerticalOffset={headerHeight}>
      {offline ? (
        <View style={styles.offline}>
          <WifiOff size={14} color={colors.warning} />
          <Text variant="caption" color="warning">
            Reconnecting… messages will still send
          </Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.skeletons}>
          <Skeleton width="55%" height={44} radius={18} />
          <Skeleton width="40%" height={44} radius={18} style={{ alignSelf: "flex-end" }} />
          <Skeleton width="65%" height={60} radius={18} />
          <Skeleton width="35%" height={44} radius={18} style={{ alignSelf: "flex-end" }} />
        </View>
      ) : loadError && messages.length === 0 ? (
        <ErrorState message={loadError} style={{ flex: 1 }} />
      ) : (
        <FlatList
          inverted
          data={rows}
          keyExtractor={(row) => row.key}
          renderItem={renderRow}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          // Inverted, so the footer sits at the top of the conversation
          ListFooterComponent={banner}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <MessageCircle size={28} color={colors.primary} />
              </View>
              <Text variant="headline" align="center">
                Start the conversation
              </Text>
              <Text variant="footnote" color="textSecondary" align="center" style={{ marginTop: 4, maxWidth: 260 }}>
                {isStudentChat
                  ? "Say where and when you can hand it over."
                  : "Describe the item and how you can prove it's yours."}
              </Text>
            </View>
          }
        />
      )}

      {isStudentChat && requestPending && !iAskedForIt ? (
        <View style={[styles.request, { paddingBottom: canType ? 14 : insets.bottom + 12 }]}>
          <Text variant="callout" style={{ marginBottom: 12 }}>
            <Text style={{ fontWeight: "600" }}>{other?.full_name || "This student"}</Text>
            {other?.registration_number ? ` (${other.registration_number})` : ""} wants to message you. Replying also
            accepts.
          </Text>
          <View style={styles.requestActions}>
            <Button title="Accept" onPress={() => respond("accept")} loading={responding} style={{ flex: 1 }} />
            <Button
              title="Decline"
              variant="secondary"
              onPress={() => respond("decline")}
              disabled={responding}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      ) : null}

      {isStudentChat && requestPending && iAskedForIt ? (
        <View style={[styles.closed, { paddingBottom: insets.bottom + 14 }]}>
          <Clock size={16} color={colors.textSecondary} />
          <Text variant="footnote" color="textSecondary" style={{ flex: 1 }}>
            Waiting for {other?.full_name?.split(" ")[0] || "them"} to accept. You can write more once they reply.
          </Text>
        </View>
      ) : null}

      {declined ? (
        <View style={[styles.closed, { paddingBottom: insets.bottom + 14 }]}>
          <Ban size={16} color={colors.textSecondary} />
          <Text variant="footnote" color="textSecondary" style={{ flex: 1 }}>
            {iAskedForIt ? "They declined your message request." : "You declined this message request."}
          </Text>
        </View>
      ) : null}

      {canType ? (
        <View style={[styles.composer, { paddingBottom: (keyboardUp ? 0 : insets.bottom) + 10 }]}>
          <View style={styles.inputWrap}>
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="Message"
              multiline
              maxLength={2000}
              style={styles.input}
              accessibilityLabel="Message"
            />
          </View>
          <IconButton
            icon={Send}
            variant="primary"
            size={46}
            iconSize={20}
            accessibilityLabel="Send"
            disabled={!inputText.trim()}
            onPress={handleSend}
          />
        </View>
      ) : null}

      <OptionSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={other?.full_name}
        options={[
          {
            value: "block",
            label: `Block ${other?.full_name?.split(" ")[0] || "this student"}`,
            description: "They won't be able to message you again",
            icon: Ban,
            destructive: true,
          },
        ]}
        onSelect={() => setTimeout(block, 250)}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerTitle: { flexDirection: "row", alignItems: "center", gap: 10, maxWidth: 240 },
  offline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
    backgroundColor: colors.warningTint,
  },
  skeletons: { flex: 1, padding: 16, gap: 12, justifyContent: "flex-end" },
  list: { paddingHorizontal: 12, paddingVertical: 12, flexGrow: 1 },
  banner: { marginHorizontal: 4, marginBottom: 12 },
  day: { alignItems: "center", marginVertical: 12 },
  dayText: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: "hidden",
  },
  messageRow: { marginBottom: 3, maxWidth: "82%" },
  rowMine: { alignSelf: "flex-end", alignItems: "flex-end" },
  rowTheirs: { alignSelf: "flex-start", alignItems: "flex-start" },
  groupEnd: { marginBottom: 10 },
  sender: { marginLeft: 12, marginBottom: 3 },
  bubble: {
    paddingHorizontal: 13,
    paddingTop: 8,
    paddingBottom: 6,
    borderRadius: 18,
  },
  bubbleMine: { backgroundColor: colors.primary },
  bubbleTheirs: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tailMine: { borderBottomRightRadius: 6 },
  tailTheirs: { borderBottomLeftRadius: 6 },
  messageText: { fontSize: 15, lineHeight: 21 },
  meta: { flexDirection: "row", alignItems: "center", alignSelf: "flex-end", gap: 4, marginTop: 2 },
  time: { fontSize: 11, lineHeight: 14 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 48 },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  request: {
    paddingHorizontal: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  requestActions: { flexDirection: "row", gap: 10 },
  closed: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  inputWrap: {
    flex: 1,
    minHeight: 46,
    maxHeight: 128,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 23,
    backgroundColor: colors.surfaceAlt,
  },
  input: { fontSize: 15, lineHeight: 21, paddingTop: 11, paddingBottom: 11, maxHeight: 124 },
});
