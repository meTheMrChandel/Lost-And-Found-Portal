import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import { chatApi, StudentLookup } from "../../api/chat";
import { errorMessage } from "../../api/client";
import { Avatar, Button, Notice, Screen, Text, TextField, useToast } from "../../ui";
import { Hash, MessageCircle, Search, Send } from "../../ui/icons";
import { colors } from "../../theme/colors";
import { radii } from "../../theme/tokens";

type Props = NativeStackScreenProps<RootStackParamList, "NewMessage">;

/** Message a student you know by registration number; they accept or decline the request. */
export const NewMessageScreen: React.FC<Props> = ({ navigation }) => {
  const toast = useToast();
  const [regNo, setRegNo] = useState("");
  const [found, setFound] = useState<StudentLookup | null>(null);
  const [message, setMessage] = useState("");
  const [finding, setFinding] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const find = async () => {
    const value = regNo.trim().toUpperCase();
    if (!value) return;
    setFinding(true);
    setError("");
    setFound(null);
    try {
      setFound(await chatApi.lookupStudent(value));
    } catch (err: any) {
      setError(
        err?.response?.status === 404
          ? "No student has that registration number. Check it and try again."
          : errorMessage(err, "Couldn't look that up."),
      );
    } finally {
      setFinding(false);
    }
  };

  const send = async () => {
    if (!found || !message.trim()) return;
    setSending(true);
    try {
      const conv = await chatApi.sendRequest(found.registration_number, message.trim());
      toast.show(`Request sent to ${found.full_name.split(" ")[0]}`);
      navigation.replace("Chat", { conversationId: conv.id, title: found.full_name });
    } catch (err: any) {
      setError(errorMessage(err, "Couldn't send the request."));
      setSending(false);
    }
  };

  const footer = found ? (
    found.existing_conversation_id ? (
      <Button
        title="Open your conversation"
        icon={MessageCircle}
        size="lg"
        fullWidth
        onPress={() =>
          navigation.replace("Chat", { conversationId: found.existing_conversation_id!, title: found.full_name })
        }
      />
    ) : (
      <Button
        title="Send request"
        icon={Send}
        size="lg"
        fullWidth
        loading={sending}
        disabled={!message.trim()}
        onPress={send}
      />
    )
  ) : (
    <Button
      title="Find student"
      icon={Search}
      size="lg"
      fullWidth
      loading={finding}
      disabled={!regNo.trim()}
      onPress={find}
    />
  );

  return (
    <Screen scroll footer={footer}>
      <Text variant="callout" color="textSecondary" style={{ marginBottom: 20 }}>
        Found something with a name or ID on it? Message its owner directly. They get one message from you and can
        accept or decline.
      </Text>

      <TextField
        label="Registration number"
        icon={Hash}
        placeholder="e.g. 2024CSB1001"
        value={regNo}
        onChangeText={(t) => {
          setRegNo(t.toUpperCase());
          setFound(null);
          setError("");
        }}
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={find}
        autoFocus
      />

      {error ? <Notice tone="danger" message={error} style={{ marginBottom: 16 }} /> : null}

      {found ? (
        <>
          <View style={styles.person}>
            <Avatar name={found.full_name} size={48} />
            <View style={{ flex: 1 }}>
              <Text variant="headline">{found.full_name}</Text>
              <Text variant="footnote" color="textSecondary">
                {found.registration_number}
              </Text>
            </View>
          </View>
          {found.existing_conversation_id ? (
            <Notice tone="info" message="You already have a conversation with this student." />
          ) : (
            <TextField
              label="Your message"
              placeholder="Say who you are and why you're writing, e.g. where you found their item"
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={1000}
              showCount
            />
          )}
        </>
      ) : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  person: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    marginBottom: 18,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
});
