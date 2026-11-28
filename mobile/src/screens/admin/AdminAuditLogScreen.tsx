import React, { useCallback, useMemo, useState } from "react";
import { View, FlatList, RefreshControl, TouchableOpacity } from "react-native";
import { Text, TextInput } from "../../ui";
import { RouteProp, useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import { adminApi, AuditLogEntry } from "../../api/admin";
import { errorMessage } from "../../api/client";
import { colors } from "../../theme/colors";
import { EmptyState, ErrorText, ScreenLoader, formatDateTime, humanize, ui } from "./adminUi";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, "AdminAuditLog">;

export const AdminAuditLogScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setEntries(await adminApi.getAuditLogs(params?.postId));
      setError("");
    } catch (err: any) {
      setError(errorMessage(err, "Failed to load the audit log."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [params?.postId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      [e.post_title, e.action, e.admin_email, e.notes, e.new_status].some((v) => (v || "").toLowerCase().includes(q))
    );
  }, [entries, filter]);

  return (
    <View style={ui.screen}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        {params?.title ? <Text style={[ui.meta, { marginBottom: 6 }]}>History of “{params.title}”</Text> : null}
        <TextInput
          value={filter}
          onChangeText={setFilter}
          placeholder="Filter by report, action, admin or note"
          placeholderTextColor={colors.textMuted}
          style={ui.input}
          autoCapitalize="none"
        />
        <ErrorText message={error} />
      </View>
      {loading ? (
        <ScreenLoader />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingTop: 6, flexGrow: 1 }}
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
          ListHeaderComponent={<Text style={[ui.muted, { marginBottom: 6 }]}>{visible.length} entr{visible.length === 1 ? "y" : "ies"}</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={ui.card}
              activeOpacity={item.post ? 0.8 : 1}
              disabled={!item.post}
              onPress={() => item.post && navigation.navigate("AdminCaseDetail", { postId: item.post })}
            >
              <Text style={ui.cardTitle}>
                {humanize(item.action)} · {item.post_title || "Deleted report"}
              </Text>
              {item.previous_status !== item.new_status && item.new_status ? (
                <Text style={ui.meta}>
                  {humanize(item.previous_status)} → {humanize(item.new_status)}
                </Text>
              ) : null}
              {item.notes ? <Text style={ui.meta}>{item.notes}</Text> : null}
              <Text style={ui.muted}>
                {item.admin_email || "Automatic"} · {formatDateTime(item.created_at)}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={error ? undefined : <EmptyState title="Nothing logged yet" />}
        />
      )}
    </View>
  );
};
