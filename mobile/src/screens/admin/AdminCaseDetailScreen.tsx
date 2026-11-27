import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Image, TextInput, Alert, RefreshControl } from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import { adminApi, CaseDetail, ReviewAction, StaffMember } from "../../api/admin";
import { Category, postsApi } from "../../api/posts";
import { errorMessage } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Badge } from "../../components/Badge";
import { CategoryChip } from "../../components/CategoryChip";
import { colors } from "../../theme/colors";
import { statusBadge } from "../reports/reportStatus";
import {
  ActionButton,
  ErrorText,
  InfoRow,
  ScreenLoader,
  Section,
  SuccessText,
  formatDateTime,
  humanize,
  ui,
} from "./adminUi";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, "AdminCaseDetail">;

const CUSTODY: Record<string, string> = {
  finder: "With the finder",
  admin_office: "Admin office",
  security_office: "Security office",
};

export const AdminCaseDetailScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { postId } = useRoute<Route>().params;
  const { user } = useAuth();
  const [post, setPost] = useState<CaseDetail | null>(null);
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Loaded only when the admin opens the category or assign pickers
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [picker, setPicker] = useState<"category" | "assign" | null>(null);
  const [pickedCategory, setPickedCategory] = useState("");
  const [pickedAssignee, setPickedAssignee] = useState("");

  const load = useCallback(async () => {
    try {
      setPost(await adminApi.getCase(postId));
      setError("");
    } catch (err: any) {
      setError(errorMessage(err, "Failed to load this report."));
    } finally {
      setRefreshing(false);
    }
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  const openPicker = async (kind: "category" | "assign") => {
    setPicker(picker === kind ? null : kind);
    try {
      if (kind === "category" && !categories) {
        setCategories(await postsApi.getCategories());
      }
      if (kind === "assign" && !staff) {
        setStaff(await adminApi.getStaff());
      }
    } catch (err: any) {
      setError(errorMessage(err, "Failed to load the options."));
    }
  };

  const review = async (action: ReviewAction, extra: { new_category?: string; assign_to?: string } = {}) => {
    if ((action === "REJECT" || action === "INFO_REQUESTED") && !remarks.trim()) {
      setError(action === "REJECT" ? "Write the reason for rejecting it first." : "Write what you need to know first.");
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result = await adminApi.reviewCase(postId, { action, remarks: remarks.trim(), ...extra });
      if (action === "DELETE" || !result.post) {
        Alert.alert("Report deleted", result.message);
        navigation.goBack();
        return;
      }
      setPost(result.post);
      setRemarks("");
      setPicker(null);
      setSuccess(result.message);
    } catch (err: any) {
      setError(errorMessage(err, "That action failed."));
    } finally {
      setBusy(false);
    }
  };

  if (!post) {
    return error ? (
      <View style={ui.center}>
        <ErrorText message={error} />
      </View>
    ) : (
      <ScreenLoader />
    );
  }

  const badge = statusBadge(post.status);
  const s = post.status;
  const canApprove = s !== "APPROVED" && s !== "RETURNED";
  const canRejectOrAsk = ["PENDING", "INFO_REQUESTED", "APPROVED", "HIDDEN"].includes(s);

  return (
    <ScrollView
      style={ui.screen}
      contentContainerStyle={ui.scroll}
      keyboardShouldPersistTaps="handled"
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
    >
      <View style={ui.badgeRow}>
        <Badge label={badge.label} variant={badge.variant} />
        <Badge label={post.post_type === "LOST" ? "Lost" : "Found"} variant={post.post_type === "LOST" ? "lost" : "found"} />
        {post.is_sla_breached ? <Badge label="Overdue review" variant="lost" /> : null}
        {post.inform_admin_privately ? <Badge label="Private to admin" variant="info" /> : null}
      </View>
      <Text style={styles.title}>{post.title}</Text>

      {post.images.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {post.images.map((img) => (
            <Image key={img.id} source={{ uri: img.image_url }} style={styles.photo} />
          ))}
        </ScrollView>
      ) : null}

      <Section title="Report">
        <Text style={[ui.body, { marginBottom: 8 }]}>{post.description || "No description."}</Text>
        <InfoRow label="Category" value={post.category_name} />
        <InfoRow label={post.post_type === "LOST" ? "Last seen at" : "Found at"} value={post.last_seen_place} />
        <InfoRow label="When" value={formatDateTime(post.last_seen_time)} />
        {post.post_type === "LOST" ? (
          <InfoRow label="Reward" value={Number(post.reward_amount) > 0 ? `₹${post.reward_amount}` : "None"} />
        ) : (
          <InfoRow label="Custody" value={CUSTODY[post.custody_location] || "—"} />
        )}
        <InfoRow label="Submitted" value={formatDateTime(post.created_at)} />
        {post.expires_at && s === "APPROVED" ? <InfoRow label="Listed until" value={formatDateTime(post.expires_at)} /> : null}
        {post.reviewed_by_email ? (
          <InfoRow label="Last reviewed" value={`${post.reviewed_by_email.split("@")[0]} · ${formatDateTime(post.reviewed_at)}`} />
        ) : null}
        <InfoRow label="Assigned to" value={post.assigned_to_email || "Nobody"} />
        {post.admin_remarks ? <InfoRow label="Admin note" value={post.admin_remarks} /> : null}
      </Section>

      {post.post_type === "LOST" ? (
        <Section title="🔒 Hidden proof (admins only)" style={styles.proof}>
          <Text style={ui.body}>{post.hidden_proof || "The owner gave no hidden proof."}</Text>
          <Text style={[ui.muted, { marginTop: 6 }]}>Ask the claimant about these details before any handover.</Text>
        </Section>
      ) : null}

      <Section title="Reported by">
        {post.author ? (
          <>
            <InfoRow label="Name" value={post.author.full_name} />
            <InfoRow label="Email" value={post.author.email} />
            <InfoRow label="Reg. no." value={post.author.registration_number} />
            <InfoRow label="Department" value={[post.author.department, humanize(post.author.program_year)].filter(Boolean).join(" · ")} />
            <InfoRow label="Hostel" value={post.author.hostel} />
            <InfoRow label="Phone" value={post.author.phone} />
            {post.author.is_banned ? <Badge label="Account banned" variant="lost" style={{ marginTop: 8 }} /> : null}
          </>
        ) : (
          <Text style={ui.meta}>The student's account was deleted.</Text>
        )}
      </Section>

      {post.registered_item ? (
        <Section title="🏷️ From a QR sticker scan">
          <InfoRow label="Registered item" value={post.registered_item.name} />
          <InfoRow label="Owner" value={`${post.registered_item.owner_name} (${post.registered_item.owner_registration_number})`} />
          <InfoRow label="Owner email" value={post.registered_item.owner_email} />
        </Section>
      ) : null}

      <Section title="Review">
        <Text style={ui.label}>Remarks (sent to the student; required to reject or ask for info)</Text>
        <TextInput
          value={remarks}
          onChangeText={setRemarks}
          placeholder="e.g. Please add the serial number or a photo"
          placeholderTextColor={colors.textMuted}
          style={[ui.input, { minHeight: 70, textAlignVertical: "top" }]}
          multiline
        />
        <ErrorText message={error} />
        <SuccessText message={success} />

        <View style={ui.actions}>
          {canApprove ? (
            <ActionButton
              label={s === "HIDDEN" ? "Restore to feed" : s === "EXPIRED" ? "Relist on feed" : "Approve & publish"}
              onPress={() => review("APPROVE")}
              disabled={busy}
            />
          ) : null}
          {canRejectOrAsk ? (
            <>
              <ActionButton label="Request info" tone="warning" onPress={() => review("INFO_REQUESTED")} disabled={busy} />
              <ActionButton label="Reject" tone="danger" onPress={() => review("REJECT")} disabled={busy} />
            </>
          ) : null}
          {s === "APPROVED" ? (
            <ActionButton label="Hide from feed" tone="neutral" onPress={() => review("HIDE")} disabled={busy} />
          ) : null}
          <ActionButton label="Change category" tone="neutral" onPress={() => openPicker("category")} disabled={busy} />
          <ActionButton
            label={post.assigned_to_email ? `Assigned: ${post.assigned_to_email.split("@")[0]}` : "Assign…"}
            tone="neutral"
            onPress={() => openPicker("assign")}
            disabled={busy}
          />
        </View>

        {picker === "category" ? (
          <View style={styles.picker}>
            <Text style={ui.label}>Move to category</Text>
            <View style={styles.chipWrap}>
              {(categories || []).map((c) => (
                <CategoryChip
                  key={c.slug}
                  label={c.name}
                  selected={pickedCategory === c.slug}
                  onPress={() => setPickedCategory(c.slug)}
                />
              ))}
            </View>
            <ActionButton
              label="Save category"
              onPress={() => review("CHANGE_CATEGORY", { new_category: pickedCategory })}
              disabled={busy || !pickedCategory || pickedCategory === post.category}
            />
          </View>
        ) : null}

        {picker === "assign" ? (
          <View style={styles.picker}>
            <Text style={ui.label}>Assign this case to</Text>
            <View style={styles.chipWrap}>
              {(staff || []).map((member) => (
                <CategoryChip
                  key={member.id}
                  label={member.id === user?.id ? "Me" : member.full_name || member.email}
                  selected={(pickedAssignee || post.assigned_to) === member.id}
                  onPress={() => setPickedAssignee(member.id)}
                />
              ))}
            </View>
            <ActionButton
              label="Assign"
              onPress={() => review("ASSIGN", { assign_to: pickedAssignee })}
              disabled={busy || !pickedAssignee || pickedAssignee === post.assigned_to}
            />
          </View>
        ) : null}

        <View style={[ui.actions, { marginTop: 16 }]}>
          <ActionButton
            label="Delete permanently"
            tone="danger"
            disabled={busy}
            onPress={() => review("DELETE")}
            confirm={{
              title: "Delete this report?",
              message: "It is removed for good, with its photos and matches. The audit log keeps a record. Hiding it is usually enough.",
            }}
          />
        </View>
      </Section>

      <Section title="History">
        {post.audit_history.length ? (
          post.audit_history.map((entry) => (
            <View key={entry.id} style={styles.historyRow}>
              <Text style={styles.historyTitle}>
                {humanize(entry.action)}
                {entry.previous_status !== entry.new_status && entry.new_status
                  ? ` · ${humanize(entry.previous_status)} → ${humanize(entry.new_status)}`
                  : ""}
              </Text>
              <Text style={ui.muted}>
                {entry.admin_email || "Automatic"} · {formatDateTime(entry.created_at)}
              </Text>
              {entry.notes ? <Text style={ui.meta}>{entry.notes}</Text> : null}
            </View>
          ))
        ) : (
          <Text style={ui.meta}>No actions yet.</Text>
        )}
      </Section>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: "800", color: colors.textPrimary, marginBottom: 10 },
  photo: { width: 200, height: 150, borderRadius: 14, marginRight: 10, backgroundColor: colors.cardSubtle },
  proof: { backgroundColor: colors.warningLight, borderColor: colors.warning },
  picker: { marginTop: 12 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  historyRow: { paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  historyTitle: { fontSize: 12, fontWeight: "700", color: colors.textPrimary },
});
