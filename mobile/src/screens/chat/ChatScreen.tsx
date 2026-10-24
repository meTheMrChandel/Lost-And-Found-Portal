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
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import { chatApi, ChatMessage, Conversation } from "../../api/chat";
import { useAuth } from "../../context/AuthContext";
import { colors } from "../../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "Chat">;

export const ChatScreen: React.FC<Props> = ({ route }) => {
  const { conversationId, title } = route.params;
  const { user } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);

  // Load messages
  const fetchMessages = async (sinceCursor?: string) => {
    try {
      const data = await chatApi.getMessages(conversationId, sinceCursor);
      if (sinceCursor && data.length > 0) {
        setMessages((prev) => [...prev, ...data]);
      } else if (!sinceCursor) {
        setMessages(data);
      }
      if (data.length > 0) {
        setLastSync(data[data.length - 1].created_at);
      }
      await chatApi.markRead(conversationId);
    } catch (e) {
      console.error("Chat load error", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    // Poll every 5s for incremental sync via ?since= cursor
    const interval = setInterval(() => {
      if (lastSync) {
        fetchMessages(lastSync);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [conversationId, lastSync]);

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;
    const textToSend = inputText.trim();
    setInputText("");
    setSending(true);

    try {
      const newMsg = await chatApi.sendMessage(conversationId, textToSend);
      setMessages((prev) => [...prev, newMsg]);
      flatListRef.current?.scrollToEnd({ animated: true });
    } catch (err: any) {
      console.error(err);
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* Header Notification Banner */}
      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          🛡️ Case Coordination • Handover verification protected by Campus Admin
        </Text>
      </View>

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
              <Text style={styles.emptyText}>No messages yet. Send a greeting to initiate handover coordination.</Text>
            </View>
          }
        />
      )}

      {/* Input Box */}
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
