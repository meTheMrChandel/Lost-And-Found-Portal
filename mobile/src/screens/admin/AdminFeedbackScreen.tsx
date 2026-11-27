import React, { useCallback, useState } from "react";
import { View, Text, FlatList, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { adminApi, FeedbackEntry } from "../../api/admin";
import { errorMessage } from "../../api/client";
import { colors } from "../../theme/colors";
import { EmptyState, ErrorText, ScreenLoader, Section, formatDateTime, ui } from "./adminUi";

export const AdminFeedbackScreen: React.FC = () => {
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [summary, setSummary] = useState<{ count: number; averageRating: number | null }>({ count: 0, averageRating: null });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await adminApi.getFeedback();
      setEntries(res.entries);
      setSummary({ count: res.count, averageRating: res.averageRating });
      setError("");
    } catch (err: any) {
      setError(errorMessage(err, "Failed to load feedback."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) return <ScreenLoader />;

  return (
    <View style={ui.screen}>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
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
        ListHeaderComponent={
          <Section title="Beta feedback">
            <Text style={ui.body}>
              {summary.count} response{summary.count === 1 ? "" : "s"}
              {summary.averageRating !== null ? ` · average ${summary.averageRating} / 5` : ""}
            </Text>
            <ErrorText message={error} />
          </Section>
        }
        renderItem={({ item }) => (
          <View style={ui.card}>
            <Text style={{ fontSize: 14, color: colors.warning, marginBottom: 4 }}>
              {"★".repeat(item.rating)}
              {"☆".repeat(Math.max(0, 5 - item.rating))}
            </Text>
            <Text style={[ui.body, { marginBottom: 6 }]}>{item.message}</Text>
            <Text style={ui.muted}>
              {item.user_name || "Deleted account"}
              {item.page ? ` · from ${item.page}` : ""} · {formatDateTime(item.created_at)}
            </Text>
          </View>
        )}
        ListEmptyComponent={error ? undefined : <EmptyState title="No feedback yet" />}
      />
    </View>
  );
};
