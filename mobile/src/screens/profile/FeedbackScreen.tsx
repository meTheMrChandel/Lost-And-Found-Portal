import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import { sendFeedback } from "../../api/feedback";
import { errorMessage } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { colors } from "../../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "Feedback">;

const MAX_LENGTH = 2000;
const RATING_LABELS = ["", "Poor", "Needs work", "Okay", "Good", "Great"];

export const FeedbackScreen: React.FC<Props> = ({ route, navigation }) => {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Sign in to send feedback</Text>
        <Button title="Sign In" onPress={() => navigation.navigate("Auth")} style={{ marginTop: 16 }} />
      </View>
    );
  }

  const submit = async () => {
    setSending(true);
    setError("");
    try {
      const res = await sendFeedback({
        rating,
        message: message.trim(),
        page: `mobile:${route.params?.from || "Profile"}`,
      });
      Alert.alert("Thank you", res.message || "Your feedback was sent to the team.");
      navigation.goBack();
    } catch (err: any) {
      setError(errorMessage(err, "Couldn't send your feedback. Please try again."));
      setSending(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>How is the Lost & Found app working for you?</Text>
      <Text style={styles.subtitle}>Your feedback goes straight to the team running the beta.</Text>

      <Text style={styles.label}>RATING</Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity key={n} onPress={() => setRating(n)} accessibilityLabel={`${n} out of 5`}>
            <Text style={[styles.star, n <= rating && styles.starOn]}>★</Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.ratingLabel}>{RATING_LABELS[rating]}</Text>
      </View>

      <Input
        label="WHAT WORKED, WHAT DIDN'T?"
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={MAX_LENGTH}
        placeholder="e.g. I couldn't find where to see my report's status"
        helperText={`${message.length}/${MAX_LENGTH}`}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        title="Send Feedback"
        onPress={submit}
        loading={sending}
        disabled={rating === 0 || !message.trim() || sending}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30, backgroundColor: colors.background },
  title: { fontSize: 18, fontWeight: "bold", color: colors.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 20 },
  label: { fontSize: 11, fontWeight: "700", color: colors.textPrimary, letterSpacing: 0.5, marginBottom: 8 },
  stars: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 20 },
  star: { fontSize: 32, color: colors.border },
  starOn: { color: colors.warning },
  ratingLabel: { fontSize: 13, color: colors.textSecondary, marginLeft: 8 },
  error: { color: colors.lost, fontSize: 12, fontWeight: "600", marginBottom: 10 },
});
