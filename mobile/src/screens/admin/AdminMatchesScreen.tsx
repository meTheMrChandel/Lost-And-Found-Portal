import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Image, ActivityIndicator } from "react-native";
import { RouteProp, useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import { adminApi, MATCH_STATUSES, MatchListItem, MatchPost, MatchStatus } from "../../api/admin";
import { errorMessage } from "../../api/client";
import { Badge } from "../../components/Badge";
import { colors } from "../../theme/colors";
import { ActionButton, ChipFilter, EmptyState, ErrorText, ScreenLoader, SuccessText, formatDateTime, humanize, ui } from "./adminUi";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, "AdminMatches">;

export function matchBadgeVariant(status: MatchStatus): "pending" | "approved" | "info" | "lost" | "default" | "found" {
  switch (status) {
    case "suggested":
      return "pending";
    case "confirmed":
    case "proof_pending":
      return "info";
    case "verified":
    case "handed_over":
      return "approved";
    case "closed":
      return "found";
    case "dismissed":
    default:
      return "default";
  }
}

const Side: React.FC<{ post: MatchPost; label: string }> = ({ post, label }) => (
  <View style={styles.side}>
    {post.images[0] ? <Image source={{ uri: post.images[0] }} style={styles.sidePhoto} /> : <View style={styles.sidePhoto} />}
    <Text style={styles.sideLabel}>{label}</Text>
    <Text style={styles.sideTitle} numberOfLines={2}>
      {post.title}
    </Text>
    <Text style={ui.muted} numberOfLines={1}>
      {post.last_seen_place}
    </Text>
  </View>
);

export const AdminMatchesScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const [status, setStatus] = useState<MatchStatus | "">((params?.status as MatchStatus) ?? "suggested");
  const [matches, setMatches] = useState<MatchListItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await adminApi.getMatches(status, 1);
      setMatches(res.results);
      setHasNext(res.hasNext);
      setCount(res.count);
      setPage(1);
      setError("");
    } catch (err: any) {
      setError(errorMessage(err, "Failed to load the match queue."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const loadMore = async () => {
    if (!hasNext || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await adminApi.getMatches(status, page + 1);
      setMatches((prev) => [...prev, ...res.results.filter((m) => !prev.some((p) => p.id === m.id))]);
      setHasNext(res.hasNext);
      setPage(page + 1);
    } catch (err: any) {
      setError(errorMessage(err, "Failed to load more matches."));
    } finally {
      setLoadingMore(false);
    }
  };

  const runEngine = async () => {
    setRunning(true);
    setError("");
    setSuccess("");
    try {
      const res = await adminApi.runMatching();
      setSuccess(
        `Matching ran over ${res.scanned_pairs} pair(s): ${res.matches_created} new, ${res.matches_updated} updated.`
      );
      load();
    } catch (err: any) {
      setError(errorMessage(err, "Failed to run the matching engine."));
    } finally {
      setRunning(false);
    }
  };

  const renderItem = ({ item }: { item: MatchListItem }) => (
    <TouchableOpacity
      style={ui.card}
      activeOpacity={0.8}
      onPress={() => navigation.navigate("AdminMatchDetail", { matchId: item.id })}
    >
      <View style={styles.header}>
        <Badge label={humanize(item.status)} variant={matchBadgeVariant(item.status)} />
        <Text style={styles.score}>{Math.round(item.score * 100)}% match</Text>
      </View>
      <View style={styles.sides}>
        <Side post={item.lost_post} label="LOST" />
        <Text style={styles.arrow}>⇄</Text>
        <Side post={item.found_post} label="FOUND" />
      </View>
      <Text style={ui.muted}>
        {item.meeting_mode ? `Meet: ${item.meeting_mode === "office" ? "via the office" : "directly"} · ` : ""}
        Suggested {formatDateTime(item.created_at)}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={ui.screen}>
      <ChipFilter
        options={MATCH_STATUSES}
        value={status}
        onChange={(value) => {
          // Show the spinner, not the previous filter's results, until the new list arrives
          if (value === status) return;
          setLoading(true);
          setStatus(value);
        }}
        allLabel="All"
      />
      <View style={styles.toolbar}>
        <Text style={ui.muted}>{count} match(es)</Text>
        <ActionButton label={running ? "Running…" : "Run matching now"} tone="neutral" onPress={runEngine} disabled={running} />
      </View>
      <View style={{ paddingHorizontal: 16 }}>
        <ErrorText message={error} />
        <SuccessText message={success} />
      </View>

      {loading ? (
        <ScreenLoader />
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ margin: 16 }} /> : undefined}
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
            error ? undefined : (
              <EmptyState
                title="No matches here"
                body={status === "suggested" ? "New lost and found pairs appear here after the matching engine runs." : "Try another status."}
              />
            )
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  list: { padding: 16, paddingTop: 6, flexGrow: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  score: { fontSize: 13, fontWeight: "800", color: colors.primary },
  sides: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  side: { flex: 1 },
  sidePhoto: { width: "100%", height: 80, borderRadius: 12, backgroundColor: colors.cardSubtle, marginBottom: 6 },
  sideLabel: { fontSize: 10, fontWeight: "800", color: colors.textSecondary, letterSpacing: 0.5 },
  sideTitle: { fontSize: 13, fontWeight: "700", color: colors.textPrimary },
  arrow: { fontSize: 18, color: colors.textMuted },
});
