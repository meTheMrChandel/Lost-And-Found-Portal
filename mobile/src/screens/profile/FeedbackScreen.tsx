import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import { sendFeedback } from "../../api/feedback";
import { errorMessage } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Button, EmptyState, haptics, Notice, Screen, Text, TextField, useToast } from "../../ui";
import { LockKeyhole, Send, Star } from "../../ui/icons";
import { colors } from "../../theme/colors";
import { radii } from "../../theme/tokens";

type Props = NativeStackScreenProps<RootStackParamList, "Feedback">;

const MAX_LENGTH = 2000;
const RATING_LABELS = ["Tap a star to rate", "Poor", "Needs work", "Okay", "Good", "Great"];

export const FeedbackScreen: React.FC<Props> = ({ route, navigation }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  if (!user) {
    return (
      <Screen>
        <EmptyState
          icon={LockKeyhole}
          title="Sign in to send feedback"
          body="Feedback is linked to your account so the team can follow up."
          actionLabel="Sign in"
          onAction={() => navigation.navigate("Auth")}
          style={{ flex: 1 }}
        />
      </Screen>
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
      haptics.success();
      toast.show(res.message || "Thanks! Your feedback went to the team.");
      navigation.goBack();
    } catch (err: any) {
      setError(errorMessage(err, "Couldn't send your feedback. Please try again."));
      setSending(false);
    }
  };

  return (
    <Screen
      scroll
      footer={
        <Button
          title="Send feedback"
          icon={Send}
          size="lg"
          fullWidth
          loading={sending}
          disabled={rating === 0 || !message.trim()}
          onPress={submit}
        />
      }
    >
      <Text variant="title2">How is the app working for you?</Text>
      <Text variant="callout" color="textSecondary" style={{ marginTop: 6 }}>
        Your feedback goes straight to the team building Lost & Found.
      </Text>

      <View style={styles.ratingCard}>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((n) => {
            const on = n <= rating;
            return (
              <Pressable
                key={n}
                onPress={() => {
                  haptics.select();
                  setRating(n);
                }}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`${n} out of 5`}
                accessibilityState={{ selected: on }}
              >
                <Star
                  size={38}
                  color={on ? colors.amber : colors.borderStrong}
                  fill={on ? colors.amber : "transparent"}
                  strokeWidth={1.6}
                />
              </Pressable>
            );
          })}
        </View>
        <Text variant="subhead" color={rating ? "textPrimary" : "textMuted"} align="center" style={{ marginTop: 10 }}>
          {RATING_LABELS[rating]}
        </Text>
      </View>

      {error ? <Notice tone="danger" message={error} style={{ marginBottom: 16 }} /> : null}

      <TextField
        label="What worked, and what didn't?"
        placeholder="e.g. I couldn't find where to see my report's status"
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={MAX_LENGTH}
        showCount
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  ratingCard: {
    marginVertical: 22,
    paddingVertical: 20,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  stars: { flexDirection: "row", justifyContent: "center", gap: 10 },
});
