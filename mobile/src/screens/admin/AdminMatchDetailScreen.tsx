import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Image, TextInput, Switch, Linking, TouchableOpacity, RefreshControl } from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";
import { RootStackParamList } from "../../navigation/types";
import { adminApi, MatchDetail, MatchPost, ProofQuestion, scoreBreakdown } from "../../api/admin";
import { errorMessage } from "../../api/client";
import { Badge } from "../../components/Badge";
import { CategoryChip } from "../../components/CategoryChip";
import { colors } from "../../theme/colors";
import { matchBadgeVariant } from "./AdminMatchesScreen";
import { ActionButton, ErrorText, InfoRow, ScreenLoader, Section, SuccessText, formatDateTime, humanize, ui } from "./adminUi";

type Route = RouteProp<RootStackParamList, "AdminMatchDetail">;

const WEIGHTS = { category: 0.35, date: 0.2, location: 0.2, text: 0.25 };
const DEFAULT_QUESTIONS: ProofQuestion[] = [
  { question: "", answer: "", is_correct: true },
  { question: "", answer: "", is_correct: true },
];

const Contact: React.FC<{ author: MatchPost["author"] }> = ({ author }) => {
  if (!author) return <Text style={ui.meta}>Account deleted</Text>;
  return (
    <View style={{ marginTop: 6 }}>
      <Text style={styles.contactName}>
        {author.full_name} · {author.registration_number}
      </Text>
      <View style={styles.contactLinks}>
        <TouchableOpacity onPress={() => Linking.openURL(`mailto:${author.email}`)}>
          <Text style={styles.link}>✉️ {author.email}</Text>
        </TouchableOpacity>
        {author.phone ? (
          <TouchableOpacity onPress={() => Linking.openURL(`tel:${author.phone}`)}>
            <Text style={styles.link}>📞 {author.phone}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

const PostCard: React.FC<{ post: MatchPost; kind: "LOST" | "FOUND" }> = ({ post, kind }) => (
  <Section title={kind === "LOST" ? "🔍 Lost report (owner)" : "📦 Found report (finder)"}>
    {post.images.length ? (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
        {post.images.map((uri) => (
          <Image key={uri} source={{ uri }} style={styles.photo} />
        ))}
      </ScrollView>
    ) : null}
    <Text style={ui.cardTitle}>{post.title}</Text>
    <Text style={[ui.body, { marginBottom: 6 }]}>{post.description}</Text>
    <InfoRow label="Category" value={post.category?.name} />
    <InfoRow label={kind === "LOST" ? "Last seen at" : "Found at"} value={post.last_seen_place} />
    <InfoRow label="When" value={formatDateTime(post.last_seen_time)} />
    {kind === "LOST" ? (
      <InfoRow label="Reward offered" value={Number(post.reward_amount) > 0 ? `₹${post.reward_amount}` : "None"} />
    ) : (
      <InfoRow label="Custody" value={humanize(post.custody_location)} />
    )}
    <InfoRow label="Report status" value={humanize(post.status)} />
    {kind === "LOST" ? (
      <View style={styles.proofBox}>
        <Text style={styles.proofLabel}>🔒 Owner's hidden proof</Text>
        <Text style={ui.body}>{post.hidden_proof || "None given."}</Text>
      </View>
    ) : null}
    <Contact author={post.author} />
  </Section>
);

export const AdminMatchDetailScreen: React.FC = () => {
  const { matchId } = useRoute<Route>().params;
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [notes, setNotes] = useState("");
  const [questions, setQuestions] = useState<ProofQuestion[]>(DEFAULT_QUESTIONS);
  const [code, setCode] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [reward, setReward] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const applyMatch = (m: MatchDetail) => {
    setMatch(m);
    setQuestions(m.proof_questions?.length ? m.proof_questions : DEFAULT_QUESTIONS);
    setReward(m.reward_amount_settled ?? m.lost_post.reward_amount ?? "0");
  };

  const load = useCallback(async () => {
    try {
      applyMatch(await adminApi.getMatch(matchId));
      setError("");
    } catch (err: any) {
      setError(errorMessage(err, "Failed to load this match."));
    } finally {
      setRefreshing(false);
    }
  }, [matchId]);

  useEffect(() => {
    load();
  }, [load]);

  /** Runs an action, then shows its message and the updated match. */
  const run = async (fn: () => Promise<{ message: string; match?: MatchDetail | null } | void>) => {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result = await fn();
      if (result?.match) applyMatch(result.match);
      else await load();
      if (result?.message) setSuccess(result.message);
      setNotes("");
    } catch (err: any) {
      setError(errorMessage(err, "That action failed."));
    } finally {
      setBusy(false);
    }
  };

  if (!match) {
    return error ? (
      <View style={ui.center}>
        <ErrorText message={error} />
      </View>
    ) : (
      <ScreenLoader />
    );
  }

  const breakdown = scoreBreakdown(match);
  const status = match.status;
  const codeGeneratedAt = match.audit_logs.find((e) => e.action === "HANDOVER_CODE_GENERATED")?.created_at;
  const filledQuestions = questions.filter((q) => q.question.trim() && q.answer.trim());

  const updateQuestion = (index: number, changes: Partial<ProofQuestion>) =>
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...changes } : q)));

  const notesInput = (
    <>
      <Text style={ui.label}>Notes (optional, kept on the case)</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="e.g. Owner described the sticker correctly"
        placeholderTextColor={colors.textMuted}
        style={ui.input}
      />
    </>
  );

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
      <Section>
        <View style={styles.header}>
          <Badge label={humanize(status)} variant={matchBadgeVariant(status)} />
          <Text style={styles.score}>{Math.round(match.score * 100)}% match</Text>
        </View>
        {breakdown ? (
          <View style={{ marginTop: 10 }}>
            {(Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).map((key) => (
              <View key={key} style={styles.barRow}>
                <Text style={styles.barLabel}>
                  {humanize(key)} ({Math.round(WEIGHTS[key] * 100)}%)
                </Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.round(breakdown[key] * 100)}%` }]} />
                </View>
                <Text style={styles.barValue}>{Math.round(breakdown[key] * 100)}%</Text>
              </View>
            ))}
          </View>
        ) : null}
        {match.admin_notes ? <InfoRow label="Admin notes" value={match.admin_notes} /> : null}
      </Section>

      <PostCard post={match.lost_post} kind="LOST" />
      <PostCard post={match.found_post} kind="FOUND" />

      {status !== "closed" && status !== "dismissed" ? (
        <Section title="Meeting">
          <Text style={ui.meta}>How the owner and finder meet once the owner is verified.</Text>
          <View style={styles.chipRow}>
            {(["office", "direct"] as const).map((mode) => (
              <CategoryChip
                key={mode}
                label={mode === "office" ? "🏢 Via the office" : "🤝 Meet directly"}
                selected={match.meeting_mode === mode}
                onPress={() =>
                  run(async () => ({ message: await adminApi.setMeetingMode(match.id, mode), match: await adminApi.getMatch(match.id) }))
                }
              />
            ))}
          </View>
        </Section>
      ) : null}

      <Section title="Next step">
        <ErrorText message={error} />
        <SuccessText message={success} />

        {status === "suggested" ? (
          <>
            <Text style={ui.meta}>
              Check that both reports describe the same item. Confirming tells the owner and the finder; dismissing tells nobody.
            </Text>
            {notesInput}
            <View style={ui.actions}>
              <ActionButton
                label="Confirm match"
                disabled={busy}
                onPress={() =>
                  run(async () => ({ message: "Match confirmed. Both students were notified.", match: await adminApi.matchAction(match.id, "CONFIRM", notes) }))
                }
              />
              <ActionButton
                label="Dismiss"
                tone="danger"
                disabled={busy}
                confirm={{ title: "Dismiss this match?", message: "It leaves the queue. The reports stay as they are." }}
                onPress={() => run(async () => ({ message: "Match dismissed.", match: await adminApi.matchAction(match.id, "DISMISS", notes) }))}
              />
            </View>
          </>
        ) : null}

        {status === "confirmed" || status === "proof_pending" ? (
          <>
            <Text style={ui.meta}>
              Ask the claimant about details only the owner would know (compare with the hidden proof above), then record
              their answers. Any wrong answer keeps the case pending.
            </Text>
            {questions.map((q, i) => (
              <View key={i} style={styles.qa}>
                <TextInput
                  value={q.question}
                  onChangeText={(text) => updateQuestion(i, { question: text })}
                  placeholder={`Question ${i + 1}, e.g. What is the lock-screen wallpaper?`}
                  placeholderTextColor={colors.textMuted}
                  style={ui.input}
                />
                <TextInput
                  value={q.answer}
                  onChangeText={(text) => updateQuestion(i, { answer: text })}
                  placeholder="Their answer"
                  placeholderTextColor={colors.textMuted}
                  style={[ui.input, { marginTop: 6 }]}
                />
                <View style={styles.qaFooter}>
                  <View style={styles.toggle}>
                    <Switch
                      value={q.is_correct}
                      onValueChange={(value) => updateQuestion(i, { is_correct: value })}
                      trackColor={{ true: colors.primary }}
                    />
                    <Text style={styles.toggleLabel}>{q.is_correct ? "Correct" : "Wrong"}</Text>
                  </View>
                  {questions.length > 1 ? (
                    <TouchableOpacity onPress={() => setQuestions((prev) => prev.filter((_, j) => j !== i))}>
                      <Text style={styles.remove}>Remove</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ))}
            <TouchableOpacity onPress={() => setQuestions((prev) => [...prev, { question: "", answer: "", is_correct: true }])}>
              <Text style={styles.link}>+ Add a question</Text>
            </TouchableOpacity>
            {notesInput}
            <View style={ui.actions}>
              <ActionButton
                label="Owner verified"
                disabled={busy || filledQuestions.length === 0}
                onPress={() => run(() => adminApi.recordProof(match.id, filledQuestions, "VERIFIED", notes))}
              />
              <ActionButton
                label="Keep pending"
                tone="warning"
                disabled={busy || filledQuestions.length === 0}
                onPress={() => run(() => adminApi.recordProof(match.id, filledQuestions, "KEEP_PENDING", notes))}
              />
              <ActionButton
                label="Reject claim"
                tone="danger"
                disabled={busy || filledQuestions.length === 0}
                confirm={{ title: "Reject this claim?", message: "The match is dismissed." }}
                onPress={() => run(() => adminApi.recordProof(match.id, filledQuestions, "REJECT", notes))}
              />
            </View>
          </>
        ) : null}

        {status === "verified" ? (
          <>
            <Text style={ui.meta}>
              Generate a one-time code and give it to the owner in person. When they collect the item, enter the code they
              show to complete the handover.
            </Text>
            {generatedCode ? (
              <View style={styles.codeBox}>
                <Text style={styles.codeLabel}>Handover code (shown only once)</Text>
                <Text style={styles.code}>{generatedCode}</Text>
              </View>
            ) : codeGeneratedAt ? (
              <Text style={ui.muted}>A code was generated {formatDateTime(codeGeneratedAt)}. A new one replaces it.</Text>
            ) : null}
            <View style={ui.actions}>
              <ActionButton
                label={codeGeneratedAt || generatedCode ? "Generate a new code" : "Generate handover code"}
                tone="neutral"
                disabled={busy}
                onPress={() =>
                  run(async () => {
                    setGeneratedCode(await adminApi.generateHandoverCode(match.id));
                    return { message: "Code generated. The owner was told the item is ready.", match: await adminApi.getMatch(match.id) };
                  })
                }
              />
            </View>
            <Text style={ui.label}>Code shown by the owner</Text>
            <TextInput
              value={code}
              onChangeText={(text) => setCode(text.toUpperCase())}
              placeholder="e.g. AB3XYZ"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              style={[ui.input, styles.codeInput]}
            />
            {notesInput}
            <View style={ui.actions}>
              <ActionButton
                label="Verify & hand over"
                disabled={busy || code.trim().length < 4}
                onPress={() =>
                  run(async () => {
                    const result = await adminApi.verifyHandoverCode(match.id, code, notes);
                    setCode("");
                    setGeneratedCode("");
                    return result;
                  })
                }
              />
            </View>
          </>
        ) : null}

        {status === "handed_over" ? (
          <>
            <Text style={ui.meta}>
              Record the reward the finder received (0 if none) and close the case. Both reports become Returned and both
              students are notified.
            </Text>
            <Text style={ui.label}>Reward settled (₹)</Text>
            <TextInput
              value={reward}
              onChangeText={setReward}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              style={ui.input}
            />
            {notesInput}
            <View style={ui.actions}>
              <ActionButton
                label="Settle & close case"
                disabled={busy}
                confirm={{ title: "Close this case?", message: `Records ₹${reward || "0"} and marks both reports returned.` }}
                onPress={() => run(() => adminApi.closeCase(match.id, reward, notes))}
              />
            </View>
          </>
        ) : null}

        {status === "closed" ? (
          <>
            <InfoRow label="Handed over" value={formatDateTime(match.handed_over_at)} />
            <InfoRow
              label="Reward settled"
              value={match.reward_amount_settled ? `₹${match.reward_amount_settled}` : "₹0"}
            />
            <InfoRow label="Closed" value={formatDateTime(match.reward_settled_at)} />
          </>
        ) : null}

        {status === "dismissed" ? <Text style={ui.meta}>This match was dismissed. Nothing more to do.</Text> : null}
      </Section>

      <Section title="Timeline">
        {match.audit_logs.map((entry) => (
          <View key={entry.id} style={styles.timelineRow}>
            <Text style={styles.timelineTitle}>
              {humanize(entry.action)}
              {entry.from_status !== entry.to_status && entry.to_status
                ? ` · ${humanize(entry.from_status) === "—" ? "" : `${humanize(entry.from_status)} → `}${humanize(entry.to_status)}`
                : ""}
            </Text>
            <Text style={ui.muted}>
              {entry.admin_name} · {formatDateTime(entry.created_at)}
            </Text>
            {entry.notes && entry.action !== "MATCH_SUGGESTED" ? <Text style={ui.meta}>{entry.notes}</Text> : null}
          </View>
        ))}
      </Section>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  score: { fontSize: 18, fontWeight: "800", color: colors.primary },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  barLabel: { width: 110, fontSize: 11, color: colors.textSecondary },
  barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.cardSubtle, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  barValue: { width: 36, fontSize: 11, fontWeight: "700", color: colors.textPrimary, textAlign: "right" },
  photo: { width: 160, height: 120, borderRadius: 12, marginRight: 8, backgroundColor: colors.cardSubtle },
  proofBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  proofLabel: { fontSize: 11, fontWeight: "800", color: colors.warning, marginBottom: 4 },
  contactName: { fontSize: 13, fontWeight: "700", color: colors.textPrimary },
  contactLinks: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 4 },
  link: { fontSize: 12, fontWeight: "700", color: colors.ocean, marginTop: 6 },
  chipRow: { flexDirection: "row", gap: 6, marginTop: 8 },
  qa: {
    marginTop: 10,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.background,
  },
  qaFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  toggle: { flexDirection: "row", alignItems: "center", gap: 6 },
  toggleLabel: { fontSize: 12, fontWeight: "600", color: colors.textPrimary },
  remove: { fontSize: 12, fontWeight: "700", color: colors.lost },
  codeBox: {
    marginTop: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: "center",
  },
  codeLabel: { fontSize: 11, fontWeight: "700", color: colors.primary },
  code: { fontSize: 32, fontWeight: "900", letterSpacing: 6, color: colors.primary, marginTop: 4 },
  codeInput: { fontSize: 18, letterSpacing: 4, fontWeight: "800", textAlign: "center" },
  timelineRow: { paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  timelineTitle: { fontSize: 12, fontWeight: "700", color: colors.textPrimary },
});
