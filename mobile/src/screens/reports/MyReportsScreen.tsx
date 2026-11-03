import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import { postsApi, MyReport } from "../../api/posts";
import { errorMessage } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { CategoryChip } from "../../components/CategoryChip";
import { colors } from "../../theme/colors";
import { REPORT_TABS, formatDate, statusBadge, tabLabel } from "./reportStatus";

export const MyReportsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const [reports, setReports] = useState<MyReport[]>([]);
  const [activeTab, setActiveTab] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setReports(await postsApi.getMyReports());
      setError("");
    } catch (err: any) {
      setError(errorMessage(err, "Failed to load your reports."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Reload whenever the screen comes back into view, e.g. after renewing or withdrawing
  useFocusEffect(
    useCallback(() => {
      if (user) load();
    }, [user, load])
  );

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Sign in to see your reports</Text>
        <Button title="Sign In" onPress={() => navigation.navigate("Auth")} style={{ marginTop: 16 }} />
      </View>
    );
  }

  const visible = activeTab === "ALL" ? reports : reports.filter((r) => r.status === activeTab);

  const renderItem = ({ item }: { item: MyReport }) => {
    const badge = statusBadge(item.status);
    const photo = item.images[0]?.image_url;
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => navigation.navigate("MyReportDetail", { report: item })}
      >
        <View style={styles.badgeRow}>
          <Badge label={badge.label} variant={badge.variant} />
          <Badge label={item.post_type === "LOST" ? "Lost" : "Found"} variant={item.post_type === "LOST" ? "lost" : "found"} />
        </View>
        {photo ? <Image source={{ uri: photo }} style={styles.photo} /> : null}
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.meta}>{item.category_name || item.category} · {item.last_seen_place}</Text>
        {item.status === "APPROVED" && item.expires_at ? (
          <Text style={styles.meta}>Listed until {formatDate(item.expires_at)}</Text>
        ) : null}
        {item.admin_remarks ? (
          <View style={styles.note}>
            <Text style={styles.noteLabel}>Admin note</Text>
            <Text style={styles.noteText}>{item.admin_remarks}</Text>
          </View>
        ) : null}
        <Text style={styles.footer}>Reported on {formatDate(item.created_at)}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={REPORT_TABS}
          keyExtractor={(tab) => tab}
          contentContainerStyle={styles.tabs}
          renderItem={({ item: tab }) => {
            const count = tab === "ALL" ? reports.length : reports.filter((r) => r.status === tab).length;
            return (
              <CategoryChip
                label={`${tabLabel(tab)} (${count})`}
                selected={activeTab === tab}
                onPress={() => setActiveTab(tab)}
              />
            );
          }}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
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
              <View style={styles.center}>
                <Text style={styles.emptyTitle}>No reports here</Text>
                <Text style={styles.meta}>Reports you submit will appear in this list.</Text>
              </View>
            )
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  tabs: { paddingHorizontal: 16, paddingVertical: 12 },
  list: { padding: 16, paddingTop: 0, flexGrow: 1 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    marginBottom: 12,
  },
  badgeRow: { flexDirection: "row", gap: 6, marginBottom: 10 },
  photo: { width: "100%", height: 150, borderRadius: 14, marginBottom: 10, backgroundColor: colors.cardSubtle },
  title: { fontSize: 16, fontWeight: "bold", color: colors.textPrimary, marginBottom: 4 },
  meta: { fontSize: 12, color: colors.textSecondary, marginBottom: 2 },
  note: {
    marginTop: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noteLabel: { fontSize: 11, fontWeight: "700", color: colors.primary, marginBottom: 2 },
  noteText: { fontSize: 12, color: colors.textPrimary },
  footer: { fontSize: 11, color: colors.textMuted, marginTop: 10 },
  error: { color: colors.lost, fontSize: 12, fontWeight: "600", paddingHorizontal: 16, marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "bold", color: colors.textPrimary, marginBottom: 4 },
});
