import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, TextInput, RefreshControl, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { adminApi, AdminUser } from "../../api/admin";
import { errorMessage } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Badge } from "../../components/Badge";
import { colors } from "../../theme/colors";
import { ActionButton, EmptyState, ErrorText, ScreenLoader, SuccessText, formatDateTime, humanize, ui } from "./adminUi";

const SEARCH_DELAY_MS = 400;

export const AdminUsersScreen: React.FC = () => {
  const { user: me } = useAuth();
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [banTarget, setBanTarget] = useState<string>("");
  const [banReason, setBanReason] = useState("");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setAppliedSearch(search.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    try {
      setUsers(await adminApi.getUsers(appliedSearch));
      setError("");
    } catch (err: any) {
      setError(errorMessage(err, "Failed to load users."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [appliedSearch]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const moderate = async (target: AdminUser, ban: boolean) => {
    setBusyId(target.id);
    setError("");
    setSuccess("");
    try {
      const result = await adminApi.moderateUser(target.id, ban, ban ? banReason.trim() : "");
      setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, ...result.user } : u)));
      setSuccess(result.message);
      setBanTarget("");
      setBanReason("");
    } catch (err: any) {
      setError(errorMessage(err, "Failed to update this account."));
    } finally {
      setBusyId("");
    }
  };

  const renderItem = ({ item }: { item: AdminUser }) => {
    const isMe = item.id === me?.id;
    return (
      <View style={ui.card}>
        <View style={ui.badgeRow}>
          {item.is_superuser ? <Badge label="Superuser" variant="info" /> : item.is_staff ? <Badge label="Admin" variant="info" /> : null}
          {item.is_banned ? <Badge label="Banned" variant="lost" /> : <Badge label="Active" variant="approved" />}
        </View>
        <Text style={ui.cardTitle}>
          {item.full_name || item.email}
          {isMe ? " (you)" : ""}
        </Text>
        <Text style={ui.meta}>
          {item.email} · {item.registration_number}
        </Text>
        <Text style={ui.meta}>
          {[item.department, humanize(item.program_year), item.hostel].filter((v) => v && v !== "—").join(" · ") || "No profile details"}
        </Text>
        {item.is_banned && item.ban_reason ? <Text style={styles.reason}>Ban reason: {item.ban_reason}</Text> : null}
        <Text style={ui.muted}>Joined {formatDateTime(item.date_joined)}</Text>

        {!item.is_superuser && !isMe ? (
          item.is_banned ? (
            <View style={ui.actions}>
              <ActionButton
                label="Reinstate account"
                disabled={busyId === item.id}
                confirm={{ title: "Reinstate this account?", message: `${item.email} can sign in and post again.` }}
                onPress={() => moderate(item, false)}
              />
            </View>
          ) : banTarget === item.id ? (
            <View style={{ marginTop: 10 }}>
              <TextInput
                value={banReason}
                onChangeText={setBanReason}
                placeholder="Reason (shown to the team)"
                placeholderTextColor={colors.textMuted}
                style={ui.input}
              />
              <View style={ui.actions}>
                <ActionButton
                  label="Ban account"
                  tone="danger"
                  disabled={busyId === item.id}
                  confirm={{
                    title: "Ban this account?",
                    message: item.is_staff
                      ? "This admin loses access to the admin console too."
                      : "They can no longer post, chat or report items.",
                  }}
                  onPress={() => moderate(item, true)}
                />
                <ActionButton label="Cancel" tone="neutral" onPress={() => setBanTarget("")} />
              </View>
            </View>
          ) : (
            <View style={ui.actions}>
              <ActionButton label="Ban…" tone="warning" onPress={() => setBanTarget(item.id)} />
            </View>
          )
        ) : null}
      </View>
    );
  };

  return (
    <View style={ui.screen}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search name, email or registration number"
          placeholderTextColor={colors.textMuted}
          style={ui.input}
          autoCapitalize="none"
        />
        <ErrorText message={error} />
        <SuccessText message={success} />
      </View>
      {loading ? (
        <ScreenLoader />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, paddingTop: 4, flexGrow: 1 }}
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
          ListHeaderComponent={<Text style={[ui.muted, { marginBottom: 6 }]}>{users.length} account(s)</Text>}
          ListEmptyComponent={error ? undefined : <EmptyState title="No accounts found" />}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  reason: { fontSize: 12, color: colors.lost, marginBottom: 2 },
});
