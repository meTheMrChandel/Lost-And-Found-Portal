import React, { useCallback, useState } from "react";
import { View, Text, FlatList, TextInput, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { adminApi, AdminInvite } from "../../api/admin";
import { errorMessage } from "../../api/client";
import { Badge } from "../../components/Badge";
import { colors } from "../../theme/colors";
import { ActionButton, EmptyState, ErrorText, ScreenLoader, Section, SuccessText, formatDateTime, ui } from "./adminUi";

function inviteState(invite: AdminInvite): { label: string; variant: "approved" | "default" | "pending" } {
  if (invite.is_used) return { label: "Accepted", variant: "approved" };
  if (invite.is_expired) return { label: "Expired", variant: "default" };
  return { label: "Pending", variant: "pending" };
}

export const AdminInvitesScreen: React.FC = () => {
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    try {
      setInvites(await adminApi.getInvites());
      setError("");
    } catch (err: any) {
      setError(errorMessage(err, "Failed to load invitations."));
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

  const send = async () => {
    setSending(true);
    setError("");
    setSuccess("");
    try {
      setSuccess(await adminApi.createInvite(email));
      setEmail("");
      await load();
    } catch (err: any) {
      setError(errorMessage(err, "Failed to send the invitation."));
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={ui.screen}>
      <FlatList
        data={invites}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
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
          <Section title="Invite a campus admin">
            <Text style={ui.meta}>
              They get an email link (valid 3 days) to set a password and activate admin access. Only @iitrpr.ac.in addresses.
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="name@iitrpr.ac.in"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={[ui.input, { marginTop: 10 }]}
            />
            <ErrorText message={error} />
            <SuccessText message={success} />
            <View style={ui.actions}>
              <ActionButton label={sending ? "Sending…" : "Send invitation"} onPress={send} disabled={sending || !email.includes("@")} />
            </View>
          </Section>
        }
        renderItem={({ item }) => {
          const state = inviteState(item);
          return (
            <View style={ui.card}>
              <View style={ui.badgeRow}>
                <Badge label={state.label} variant={state.variant} />
              </View>
              <Text style={ui.cardTitle}>{item.email}</Text>
              <Text style={ui.muted}>
                Sent {formatDateTime(item.created_at)}
                {item.invited_by_email ? ` by ${item.invited_by_email.split("@")[0]}` : ""}
                {item.is_used ? ` · accepted ${formatDateTime(item.used_at)}` : ` · expires ${formatDateTime(item.expires_at)}`}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={loading ? <ScreenLoader /> : error ? undefined : <EmptyState title="No invitations yet" />}
      />
    </View>
  );
};
