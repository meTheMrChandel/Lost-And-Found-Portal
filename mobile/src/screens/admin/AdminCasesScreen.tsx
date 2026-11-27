import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, TextInput, Image, Switch } from "react-native";
import { RouteProp, useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import { adminApi, CaseListItem, POST_STATUSES, PostStatus } from "../../api/admin";
import { errorMessage } from "../../api/client";
import { Badge } from "../../components/Badge";
import { colors } from "../../theme/colors";
import { statusBadge } from "../reports/reportStatus";
import { ChipFilter, EmptyState, ErrorText, ScreenLoader, formatDateTime, ui } from "./adminUi";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, "AdminCases">;

const TYPES = ["LOST", "FOUND"] as const;
const SEARCH_DELAY_MS = 400;

export const AdminCasesScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const [status, setStatus] = useState<PostStatus | "">((params?.status as PostStatus) || "");
  const [postType, setPostType] = useState<(typeof TYPES)[number] | "">("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(Boolean(params?.slaBreached));
  const [mineOnly, setMineOnly] = useState(Boolean(params?.assignedToMe));
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Search once the admin stops typing
  useEffect(() => {
    const timer = setTimeout(() => setAppliedSearch(search.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    try {
      setCases(
        await adminApi.getCases({
          status: overdueOnly ? "" : status,
          post_type: postType,
          search: appliedSearch,
          sla_breached: overdueOnly,
          assigned_to: mineOnly ? "me" : undefined,
        })
      );
      setError("");
    } catch (err: any) {
      setError(errorMessage(err, "Failed to load the case queue."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status, postType, appliedSearch, overdueOnly, mineOnly]);

  // Reload on focus (after reviewing a case) and whenever a filter changes
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const renderItem = ({ item }: { item: CaseListItem }) => {
    const badge = statusBadge(item.status);
    const photo = item.images[0]?.image_url;
    return (
      <TouchableOpacity
        style={ui.card}
        activeOpacity={0.8}
        onPress={() => navigation.navigate("AdminCaseDetail", { postId: item.id })}
      >
        <View style={styles.row}>
          {photo ? <Image source={{ uri: photo }} style={styles.thumb} /> : null}
          <View style={{ flex: 1 }}>
            <View style={ui.badgeRow}>
              <Badge label={badge.label} variant={badge.variant} />
              <Badge label={item.post_type === "LOST" ? "Lost" : "Found"} variant={item.post_type === "LOST" ? "lost" : "found"} />
              {item.is_sla_breached ? <Badge label="Overdue" variant="lost" /> : null}
            </View>
            <Text style={ui.cardTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={ui.meta} numberOfLines={1}>
              {item.category_name} · {item.last_seen_place}
            </Text>
            <Text style={ui.meta} numberOfLines={1}>
              By {item.author_name || "deleted account"}
              {item.author_registration_number ? ` (${item.author_registration_number})` : ""}
            </Text>
            <Text style={ui.muted}>
              Submitted {formatDateTime(item.created_at)}
              {item.assigned_to_email ? ` · Assigned to ${item.assigned_to_email.split("@")[0]}` : ""}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={ui.screen}>
      <View style={styles.searchBox}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search title, place, student name, email or reg. no."
          placeholderTextColor={colors.textMuted}
          style={ui.input}
          autoCapitalize="none"
          returnKeyType="search"
        />
      </View>

      {!overdueOnly ? (
        <ChipFilter
          options={POST_STATUSES}
          value={status}
          onChange={setStatus}
          allLabel="All statuses"
          label={(s) => statusBadge(s).label}
        />
      ) : null}
      <ChipFilter options={TYPES} value={postType} onChange={setPostType} allLabel="Lost & found" />

      <View style={styles.toggles}>
        <View style={styles.toggle}>
          <Switch value={overdueOnly} onValueChange={setOverdueOnly} trackColor={{ true: colors.lost }} />
          <Text style={styles.toggleLabel}>Overdue reviews</Text>
        </View>
        <View style={styles.toggle}>
          <Switch value={mineOnly} onValueChange={setMineOnly} trackColor={{ true: colors.primary }} />
          <Text style={styles.toggleLabel}>Assigned to me</Text>
        </View>
      </View>

      {error ? (
        <View style={{ paddingHorizontal: 16 }}>
          <ErrorText message={error} />
        </View>
      ) : null}

      {loading ? (
        <ScreenLoader />
      ) : (
        <FlatList
          data={cases}
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
          ListHeaderComponent={<Text style={ui.muted}>{cases.length} report(s)</Text>}
          ListEmptyComponent={error ? undefined : <EmptyState title="No reports here" body="Try another filter." />}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  searchBox: { paddingHorizontal: 16, paddingTop: 12 },
  toggles: { flexDirection: "row", gap: 16, paddingHorizontal: 16, paddingBottom: 6 },
  toggle: { flexDirection: "row", alignItems: "center", gap: 6 },
  toggleLabel: { fontSize: 12, fontWeight: "600", color: colors.textPrimary },
  list: { padding: 16, paddingTop: 6, flexGrow: 1 },
  row: { flexDirection: "row", gap: 12 },
  thumb: { width: 64, height: 64, borderRadius: 12, backgroundColor: colors.cardSubtle },
});
