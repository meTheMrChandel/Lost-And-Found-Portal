import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import { chatApi, ChatMessage, Conversation } from "../../api/chat";
import { errorMessage, storage, websocketUrl } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/Button";
import { colors } from "../../theme/colors";
import { conversationTitle, otherParticipant } from "./conversationLabel";

type Props = NativeStackScreenProps<RootStackParamList, "Chat">;

export const ChatScreen: React.FC<Props> = ({ route, navigation }) => {
  const { conversationId, title } = route.params;
  const { user } = useAuth();

  // Who's on the other side, and where a student conversation stands
  const [conv, setConv] = useState<Conversation | null>(null);
  const [responding, setResponding] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const flatListRef = useRef<FlatList>(null);
  const socketRef = useRef<WebSocket | null>(null);
  // Newest message we hold, so a reconnect only fetches what was missed
  const lastSyncRef = useRef<string | null>(null);
  const userIdRef = useRef(user?.id);
  userIdRef.current = user?.id;

  const addMessages = (incoming: ChatMessage[]) => {
    if (incoming.length === 0) return;
    setMessages((prev) => {
      const known = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !known.has(m.id));
      return fresh.length ? [...prev, ...fresh] : prev;
    });
    const newest = incoming[incoming.length - 1].created_at;
    if (!lastSyncRef.current || newest > lastSyncRef.current) lastSyncRef.current = newest;
  };

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
        await chatApi.markRead(conversationId);
      } catch (err: any) {
        if (!closedByUs) setError(errorMessage(err, "Couldn't load messages."));
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
        setError("");
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
              sender: { id: m.sender_id, full_name: m.sender_name || "Campus User", email: "", registration_number: "" },
              content: m.content,
              is_read: !!m.is_read,
              is_me: isMe,
              created_at: m.created_at || new Date().toISOString(),
            },
          ]);
          if (!isMe) socket.send(JSON.stringify({ action: "mark_read" }));
          markAcceptedIfReply(m.sender_id);
        } else if (payload.type === "read_receipt" && payload.reader_id !== userIdRef.current) {
          setMessages((prev) => prev.map((m) => (m.is_me || m.sender_id === userIdRef.current ? { ...m, is_read: true } : m)));
        } else if (payload.type === "error" && payload.error) {
          setError(String(payload.error));
        }
      };

      socket.onclose = (event) => {
        if (socketRef.current === socket) socketRef.current = null;
        // 4403: not a participant of this conversation, retrying won't help
        if (closedByUs || event.code === 4403) return;
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
        if (closedByUs) return;
        setConv(c);
        // Opened from a notification: name the other student in the header
        if (!title) navigation.setOptions({ title: conversationTitle(c, userIdRef.current) });
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
  }, [conversationId]);

  // The recipient writing back means the request was accepted
  const markAcceptedIfReply = (senderId: string) => {
    setConv((c) =>
      c && c.request_status === "pending" && senderId !== c.requested_by ? { ...c, request_status: "accepted" } : c
    );
  };

  const respond = async (action: "accept" | "decline") => {
    setResponding(true);
    setError("");
    try {
      setConv(await chatApi.respondToRequest(conversationId, action));
    } catch (err: any) {
      setError(errorMessage(err, "Couldn't answer the request."));
    } finally {
      setResponding(false);
    }
  };

  const block = () => {
    const other = conv && otherParticipant(conv, user?.id);
    if (!other) return;
    Alert.alert(`Block ${other.full_name}?`, "They won't be able to message you again.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Block",
        style: "destructive",
        onPress: async () => {
          try {
            await chatApi.toggleBlock(other.id);
            navigation.goBack();
          } catch (err: any) {
            setError(errorMessage(err, "Couldn't block them."));
          }
        },
      },
    ]);
  };

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;
    const textToSend = inputText.trim();
    setInputText("");
    setError("");

    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      // The server broadcasts it back to us, which adds it to the list
      socket.send(JSON.stringify({ action: "send_message", content: textToSend }));
      return;
    }

    // No live connection: fall back to REST
    setSending(true);
    try {
      const newMsg = await chatApi.sendMessage(conversationId, textToSend);
      addMessages([newMsg]);
      if (user) markAcceptedIfReply(user.id);
      flatListRef.current?.scrollToEnd({ animated: true });
    } catch (err: any) {
      setInputText(textToSend);
      setError(errorMessage(err, "Message not sent. Please try again."));
    } finally {
      setSending(false);
    }
  };

  const renderMessageItem = ({ item }: { item: ChatMessage }) => {
    const isMe = item.is_me || item.sender_id === user?.id;

    return (
      <View style={[styles.bubbleWrapper, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
        {!isMe && <Text style={styles.senderName}>{item.sender?.full_name || "Campus User"}</Text>}
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          <Text style={[styles.messageContent, isMe ? styles.textMe : styles.textOther]}>
            {item.content}
          </Text>
          <View style={styles.timeRow}>
            <Text style={[styles.timeText, isMe ? styles.timeMe : styles.timeOther]}>
              {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
            {isMe && <Text style={styles.checkText}>{item.is_read ? "✓✓" : "✓"}</Text>}
          </View>
        </View>
      </View>
    );
  };

  const isStudentChat = conv?.conversation_type === "student";
  const other = conv ? otherParticipant(conv, user?.id) : undefined;
  const pending = conv?.request_status === "pending";
  const iAskedForIt = !!conv && conv.requested_by === user?.id;
  const declined = isStudentChat && conv?.request_status === "declined";
  // The requester's one message is already sent; the recipient answers with the buttons or by replying
  const canType = !declined && !(isStudentChat && pending && iAskedForIt);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* Header Notification Banner */}
      {!isStudentChat ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            🛡️ Case Coordination • Handover verification protected by Campus Admin
          </Text>
        </View>
      ) : conv?.item ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            {conv.item.owner_id === user?.id ? `About your ${conv.item.name}` : `About ${conv.item.name}`}
            {" · started from its QR sticker"}
          </Text>
        </View>
      ) : null}

      {isStudentChat && pending && iAskedForIt && (
        <View style={styles.requestNote}>
          <Text style={styles.requestText}>
            Waiting for {other?.full_name || "them"} to accept. You can send more once they reply.
          </Text>
        </View>
      )}

      {isStudentChat && pending && !iAskedForIt && (
        <View style={styles.requestNote}>
          <Text style={styles.requestText}>
            {other?.full_name || "This student"}
            {other?.registration_number ? ` (${other.registration_number})` : ""} wants to message you. Replying
            also accepts.
          </Text>
          <View style={styles.requestActions}>
            <Button title="Accept" onPress={() => respond("accept")} loading={responding} style={styles.requestBtn} />
            <Button
              title="Decline"
              variant="outline"
              onPress={() => respond("decline")}
              disabled={responding}
              style={styles.requestBtn}
            />
            <Button
              title="Block"
              variant="ghost"
              onPress={block}
              textStyle={{ color: colors.lost }}
              style={styles.requestBtn}
            />
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Syncing messages...</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessageItem}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🕊️</Text>
              <Text style={styles.emptyText}>
                {isStudentChat
                  ? "No messages yet. Say where and when you can hand it over."
                  : "No messages yet. Send a greeting to initiate handover coordination."}
              </Text>
            </View>
          }
        />
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {declined && (
        <Text style={styles.closedNote}>
          {iAskedForIt ? "They declined your message request." : "You declined this message request."}
        </Text>
      )}

      {/* Input Box */}
      {canType && (
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Type message..."
            placeholderTextColor={colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.textWhite} />
            ) : (
              <Text style={styles.sendIcon}>➤</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  banner: {
    backgroundColor: colors.oceanLight,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#BAE6FD",
  },
  bannerText: {
    fontSize: 11,
    color: "#0369A1",
    fontWeight: "600",
    textAlign: "center",
  },
  requestNote: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  requestText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  requestActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  requestBtn: {
    flex: 1,
    height: 38,
    paddingHorizontal: 8,
  },
  closedNote: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
    padding: 14,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 8,
    fontSize: 12,
    color: colors.textSecondary,
  },
  messagesList: {
    padding: 16,
    gap: 12,
  },
  bubbleWrapper: {
    maxWidth: "80%",
    marginBottom: 8,
  },
  bubbleRight: {
    alignSelf: "flex-end",
  },
  bubbleLeft: {
    alignSelf: "flex-start",
  },
  senderName: {
    fontSize: 10,
    color: colors.textMuted,
    marginBottom: 2,
    marginLeft: 6,
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMe: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderBottomLeftRadius: 4,
  },
  messageContent: {
    fontSize: 13,
    lineHeight: 18,
  },
  textMe: {
    color: colors.textWhite,
  },
  textOther: {
    color: colors.textPrimary,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 4,
  },
  timeText: {
    fontSize: 9,
  },
  timeMe: {
    color: "rgba(255,255,255,0.7)",
  },
  timeOther: {
    color: colors.textMuted,
  },
  checkText: {
    fontSize: 9,
    color: "rgba(255,255,255,0.8)",
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    marginTop: 50,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },
  errorText: {
    color: colors.lost,
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: colors.lostLight,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    gap: 10,
  },
  textInput: {
    flex: 1,
    maxHeight: 100,
    backgroundColor: colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendIcon: {
    color: colors.textWhite,
    fontSize: 16,
    fontWeight: "bold",
    transform: [{ rotate: "0deg" }],
  },
});
