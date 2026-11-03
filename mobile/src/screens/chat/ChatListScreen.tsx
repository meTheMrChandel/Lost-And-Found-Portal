import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { chatApi, Conversation, StudentLookup } from "../../api/chat";
import { errorMessage } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { colors } from "../../theme/colors";
import { conversationNote, conversationTitle } from "./conversationLabel";

export const ChatListScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // New chat by registration number
  const [regNo, setRegNo] = useState("");
  const [found, setFound] = useState<StudentLookup | null>(null);
  const [firstMessage, setFirstMessage] = useState("");
  const [finding, setFinding] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setConversations(await chatApi.getConversations());
    } catch (err: any) {
      setError(errorMessage(err, "Couldn't load your conversations."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (user) load();
      else setLoading(false);
    }, [user?.id])
  );

  const openConversation = (id: string, title?: string) => navigation.navigate("Chat", { conversationId: id, title });

  const handleFind = async () => {
    if (!regNo.trim()) return;
    setFinding(true);
    setError("");
    setFound(null);
    try {
      setFound(await chatApi.lookupStudent(regNo.trim()));
    } catch (err: any) {
      setError(
        err?.response?.status === 404
          ? "No student has that registration number. Check it and try again."
          : errorMessage(err, "Couldn't look that up.")
      );
    } finally {
      setFinding(false);
    }
  };

  const handleSendRequest = async () => {
    if (!found || !firstMessage.trim()) return;
    setSending(true);
    setError("");
    try {
      const conv = await chatApi.sendRequest(found.registration_number, firstMessage.trim());
      setRegNo("");
      setFound(null);
      setFirstMessage("");
      openConversation(conv.id, found.full_name);
    } catch (err: any) {
      setError(errorMessage(err, "Couldn't send the request."));
    } finally {
      setSending(false);
    }
  };

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Sign in to see your messages</Text>
        <Button title="Sign In" onPress={() => navigation.navigate("Auth")} style={{ marginTop: 14 }} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          colors={[colors.primary]}
        />
      }
    >
      <View style={styles.card}>
        <Text style={styles.cardTitle}>New chat</Text>
        <Text style={styles.cardHint}>
          Know who it belongs to? Enter their registration number. They get one message from you and can accept
          or decline it.
        </Text>
        <Input
          placeholder="e.g. 2024CSM1001"
          value={regNo}
          onChangeText={(t) => {
            setRegNo(t);
            setFound(null);
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={handleFind}
          containerStyle={{ marginBottom: 10 }}
        />
        {!found && (
          <Button title="Find" variant="outline" onPress={handleFind} loading={finding} disabled={!regNo.trim()} />
        )}

        {found && (
          <View style={styles.foundBox}>
            <Text style={styles.foundName}>{found.full_name}</Text>
            <Text style={styles.foundReg}>{found.registration_number}</Text>
            {found.existing_conversation_id ? (
              <Button
                title="Open your conversation"
                onPress={() => openConversation(found.existing_conversation_id!, found.full_name)}
                style={{ marginTop: 12 }}
              />
            ) : (
              <>
                <Input
                  placeholder="Say who you are and why you're writing"
                  value={firstMessage}
                  onChangeText={setFirstMessage}
                  multiline
                  maxLength={1000}
                  containerStyle={{ marginTop: 12, marginBottom: 10 }}
                />
                <Button
                  title="Send request"
                  onPress={handleSendRequest}
                  loading={sending}
                  disabled={!firstMessage.trim()}
                />
              </>
            )}
          </View>
        )}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>

      <Text style={styles.sectionTitle}>Conversations</Text>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
      ) : conversations.length === 0 ? (
        <Text style={styles.emptyText}>Nothing here yet.</Text>
      ) : (
        conversations.map((conv) => {
          const title = conversationTitle(conv, user.id);
          const waitingOnMe = conv.request_status === "pending" && conv.requested_by !== user.id;
          return (
            <TouchableOpacity
              key={conv.id}
              style={styles.row}
              activeOpacity={0.7}
              onPress={() => openConversation(conv.id, title)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{title}</Text>
                <Text style={[styles.rowNote, waitingOnMe && styles.rowNoteStrong]} numberOfLines={1}>
                  {conversationNote(conv, user.id)}
                </Text>
              </View>
              {conv.unread_count > 0 && <Text style={styles.unread}>{conv.unread_count}</Text>}
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
    backgroundColor: colors.background,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  cardHint: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
    marginTop: 4,
    marginBottom: 12,
  },
  foundBox: {
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  foundName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  foundReg: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  errorText: {
    color: colors.lost,
    fontSize: 12,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    gap: 10,
  },
  rowTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  rowNote: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rowNoteStrong: {
    color: colors.textPrimary,
    fontWeight: "600",
  },
  unread: {
    fontSize: 12,
    fontWeight: "bold",
    color: colors.primary,
  },
  arrow: {
    fontSize: 20,
    color: colors.textMuted,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  emptyText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
