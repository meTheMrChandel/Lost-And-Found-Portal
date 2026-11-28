import React, { useCallback, useEffect, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  Share,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Image } from "expo-image";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RootStackParamList } from "../../navigation/types";
import { goBackOrHome } from "../../navigation/goBackOrHome";
import { errorMessage, WEB_URL } from "../../api/client";
import { chatApi } from "../../api/chat";
import { Post, postsApi } from "../../api/posts";
import { useAuth } from "../../context/AuthContext";
import {
  Avatar,
  Badge,
  BottomSheet,
  Button,
  ErrorState,
  IconButton,
  Notice,
  PressableScale,
  Skeleton,
  Text,
  TextField,
  useKeyboardVisible,
  useToast,
} from "../../ui";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  Check,
  Flag,
  Gift,
  IconType,
  MapPin,
  MessageCircle,
  Pencil,
  Share2,
  ShieldCheck,
  Tag,
} from "../../ui/icons";
import { colors } from "../../theme/colors";
import { radii, SCREEN_PADDING } from "../../theme/tokens";
import { categoryIcon } from "../../utils/categories";
import { formatDateTime, formatRupees, timeAgo } from "../../utils/format";

type Props = NativeStackScreenProps<RootStackParamList, "ItemDetail">;

const CUSTODY: Record<string, string> = {
  finder: "With the finder",
  admin_office: "Admin office",
  security_office: "Security office",
};

const ABUSE_REASONS = [
  { value: "spam", label: "Spam", description: "Advertising or repeated posts" },
  { value: "fake", label: "Fake or misleading", description: "The item or details look made up" },
  { value: "inappropriate", label: "Inappropriate", description: "Offensive photos or text" },
  { value: "other", label: "Something else", description: "Tell us what's wrong" },
];

const DetailRow: React.FC<{ icon: IconType; label: string; value: string }> = ({ icon: Icon, label, value }) => (
  <View style={styles.detailRow}>
    <View style={styles.detailIcon}>
      <Icon size={18} color={colors.primary} strokeWidth={2} />
    </View>
    <View style={{ flex: 1 }}>
      <Text variant="caption" color="textSecondary">
        {label}
      </Text>
      <Text variant="bodyMedium">{value}</Text>
    </View>
  </View>
);

/** Swipeable photos with a page indicator. */
const Gallery: React.FC<{ post: Post; width: number; height: number }> = ({ post, width, height }) => {
  const [index, setIndex] = useState(0);
  const isLost = post.post_type === "lost";

  if (!post.images.length) {
    const Icon = categoryIcon(typeof post.category === "string" ? post.category : post.category?.slug);
    return (
      <View
        style={[styles.heroPlaceholder, { height, backgroundColor: isLost ? colors.lostTint : colors.primaryTint }]}
      >
        <View style={[styles.heroIcon, { backgroundColor: isLost ? colors.lostSoft : colors.primarySoft }]}>
          <Icon size={56} color={isLost ? colors.lost : colors.primary} strokeWidth={1.5} />
        </View>
        <Text variant="footnote" color="textSecondary" style={{ marginTop: 14 }}>
          No photos were added
        </Text>
      </View>
    );
  }

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  };

  return (
    <View style={{ height }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={32}
      >
        {post.images.map((img) => (
          <Image
            key={img.id}
            source={{ uri: img.image_url }}
            style={{ width, height, backgroundColor: colors.surfaceAlt }}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
            accessibilityLabel={`Photo of ${post.title}`}
          />
        ))}
      </ScrollView>
      {post.images.length > 1 ? (
        <View style={styles.dots} pointerEvents="none">
          {post.images.map((img, i) => (
            <View key={img.id} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
};

export const ItemDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { postId } = route.params;
  const { user } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const keyboardUp = useKeyboardVisible();

  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState("");
  const [openingChat, setOpeningChat] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      setPost(await postsApi.getPostDetail(postId));
    } catch (err: any) {
      setError(errorMessage(err, "Couldn't load this item."));
    }
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  const heroHeight = Math.round(width * 0.78);
  const isLost = post?.post_type === "lost";
  const isMine =
    !!user && !!post?.author_registration_number && post.author_registration_number === user.registration_number;

  const requireSignIn = (): boolean => {
    if (user) return true;
    navigation.navigate("Auth");
    return false;
  };

  const contactAdmin = async () => {
    if (!post || !requireSignIn()) return;
    setOpeningChat(true);
    try {
      const conversation = await chatApi.openAdminConversation();
      const draft = isLost
        ? `Hi, I think I've found the item in the lost report "${post.title}".`
        : `Hi, I think the item in the found report "${post.title}" is mine.`;
      navigation.navigate("Chat", { conversationId: conversation.id, title: "Admin office", draft });
    } catch (err: any) {
      toast.show(errorMessage(err, "Couldn't open the chat."), "error");
    } finally {
      setOpeningChat(false);
    }
  };

  const share = () => {
    if (!post) return;
    const place = post.campus_location ? ` near ${post.campus_location}` : "";
    const link = WEB_URL ? `\n${WEB_URL}/feed` : "";
    Share.share({
      message: `${isLost ? "Lost" : "Found"} on campus${place}: ${post.title}. Seen it? Check IIT Ropar Lost & Found.${link}`,
    }).catch(() => {});
  };

  const openReport = () => {
    if (!requireSignIn()) return;
    if (reported) {
      toast.show("You've already reported this listing.", "info");
      return;
    }
    setReason("");
    setDetails("");
    setReportOpen(true);
  };

  const submitReport = async () => {
    if (!post || !reason) return;
    setReporting(true);
    try {
      await postsApi.reportAbuse(post.id, reason, details.trim());
      setReported(true);
      setReportOpen(false);
      toast.show("Thanks. The admin team will review this listing.");
    } catch (err: any) {
      toast.show(errorMessage(err, "Couldn't send your report."), "error");
    } finally {
      setReporting(false);
    }
  };

  const topBar = (
    <View style={[styles.topBar, { top: insets.top + 8 }]} pointerEvents="box-none">
      <IconButton icon={ArrowLeft} variant="overlay" accessibilityLabel="Back" onPress={() => goBackOrHome(navigation)} />
      {post ? (
        <View style={styles.topActions}>
          <IconButton icon={Share2} variant="overlay" accessibilityLabel="Share" onPress={share} />
          {!isMine ? (
            <IconButton icon={Flag} variant="overlay" accessibilityLabel="Report this listing" onPress={openReport} />
          ) : null}
        </View>
      ) : null}
    </View>
  );

  if (error && !post) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 64 }]}>
        {topBar}
        <ErrorState message={error} onRetry={load} />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.screen}>
        <Skeleton height={heroHeight} radius={0} />
        <View style={[styles.sheet, { gap: 14 }]}>
          <Skeleton width={120} height={22} radius={11} />
          <Skeleton width="80%" height={26} />
          <Skeleton width="45%" height={14} />
          <Skeleton height={150} radius={radii.lg} style={{ marginTop: 8 }} />
          <Skeleton height={80} radius={radii.lg} />
        </View>
        {topBar}
      </View>
    );
  }

  const status = post.status && post.status !== "APPROVED" ? post.status : null;
  const CategoryIcon = categoryIcon(typeof post.category === "string" ? post.category : post.category?.slug);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <Gallery post={post} width={width} height={heroHeight} />

        <View style={styles.sheet}>
          <View style={styles.badges}>
            <Badge label={isLost ? "Lost" : "Found"} tone={isLost ? "danger" : "success"} dot size="md" />
            {post.category_name ? <Badge label={post.category_name} icon={CategoryIcon} size="md" /> : null}
            {status ? (
              <Badge
                label={status === "PENDING" ? "In review" : status.replace(/_/g, " ").toLowerCase()}
                tone="warning"
                size="md"
              />
            ) : null}
          </View>

          <Text variant="title1" style={styles.title}>
            {post.title}
          </Text>
          <Text variant="footnote" color="textSecondary">
            Reported {timeAgo(post.created_at).toLowerCase()}
          </Text>

          {isLost && post.reward_amount ? (
            <View style={styles.reward}>
              <View style={styles.rewardIcon}>
                <Gift size={22} color={colors.reward} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="title3" style={{ color: colors.reward }}>
                  {formatRupees(post.reward_amount)} reward
                </Text>
                <Text variant="footnote" color="textSecondary">
                  Offered by the owner to whoever returns it
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.detailsCard}>
            <DetailRow icon={MapPin} label={isLost ? "Last seen at" : "Found at"} value={post.campus_location} />
            <View style={styles.divider} />
            <DetailRow
              icon={CalendarClock}
              label={isLost ? "Lost on" : "Found on"}
              value={formatDateTime(post.incident_date)}
            />
            {!isLost && post.custody_location ? (
              <>
                <View style={styles.divider} />
                <DetailRow
                  icon={Building2}
                  label="Where it is now"
                  value={CUSTODY[post.custody_location] || post.custody_location}
                />
              </>
            ) : null}
            {post.category_name ? (
              <>
                <View style={styles.divider} />
                <DetailRow icon={Tag} label="Category" value={post.category_name} />
              </>
            ) : null}
          </View>

          {post.description ? (
            <View style={styles.section}>
              <Text variant="overline" color="textSecondary" style={styles.sectionTitle}>
                Description
              </Text>
              <Text variant="body" style={{ lineHeight: 23 }}>
                {post.description}
              </Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text variant="overline" color="textSecondary" style={styles.sectionTitle}>
              Reported by
            </Text>
            <View style={styles.person}>
              <Avatar name={post.author?.full_name} size={44} />
              <View style={{ flex: 1 }}>
                <Text variant="headline">{isMine ? "You" : post.author?.full_name || "Campus member"}</Text>
                {post.author?.registration_number ? (
                  <Text variant="footnote" color="textSecondary">
                    {post.author.registration_number}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>

          <Notice
            tone="neutral"
            icon={ShieldCheck}
            title="Safe hand-overs"
            message="The admin office checks proof of ownership before anything is returned. Never share personal details in public."
            style={{ marginTop: 22 }}
          />
        </View>
      </ScrollView>

      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 12 }]}>
        {isMine ? (
          <Button
            title="Manage my report"
            icon={Pencil}
            size="lg"
            fullWidth
            onPress={() => navigation.navigate("MyReportDetail", { reportId: post.id })}
          />
        ) : (
          <Button
            title={!user ? "Sign in to respond" : isLost ? "I found this item" : "This is mine"}
            icon={MessageCircle}
            size="lg"
            fullWidth
            loading={openingChat}
            onPress={contactAdmin}
          />
        )}
      </View>

      {topBar}

      <BottomSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Report this listing"
        subtitle="Tell the admins what's wrong. The person who posted it won't know it was you."
      >
        <View style={{ gap: 8 }}>
          {ABUSE_REASONS.map((r) => {
            const selected = reason === r.value;
            return (
              <PressableScale
                key={r.value}
                onPress={() => setReason(r.value)}
                scaleTo={0.985}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[styles.reason, selected && styles.reasonSelected]}
              >
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium">{r.label}</Text>
                  <Text variant="footnote" color="textSecondary">
                    {r.description}
                  </Text>
                </View>
                <View style={[styles.radio, selected && styles.radioOn]}>
                  {selected ? <Check size={14} color={colors.textWhite} strokeWidth={3} /> : null}
                </View>
              </PressableScale>
            );
          })}
        </View>
        {reason ? (
          <TextField
            placeholder={reason === "other" ? "What's wrong with it?" : "Anything else the admins should know?"}
            value={details}
            onChangeText={setDetails}
            multiline
            maxLength={500}
            containerStyle={{ marginTop: 14, marginBottom: 0 }}
            style={{ minHeight: 80 }}
          />
        ) : null}
        <Button
          title="Send report"
          variant="danger"
          size="lg"
          fullWidth
          loading={reporting}
          disabled={!reason || (reason === "other" && !details.trim())}
          onPress={submitReport}
          style={{ marginTop: keyboardUp ? 12 : 18 }}
        />
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  topBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  topActions: { flexDirection: "row", gap: 10 },
  heroPlaceholder: { alignItems: "center", justifyContent: "center" },
  heroIcon: { width: 112, height: 112, borderRadius: 56, alignItems: "center", justifyContent: "center" },
  dots: {
    position: "absolute",
    bottom: 34,
    alignSelf: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: "rgba(28,28,30,0.4)",
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.55)" },
  dotActive: { width: 16, backgroundColor: colors.textWhite },
  sheet: {
    marginTop: -22,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    backgroundColor: colors.background,
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 22,
  },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  title: { marginTop: 14, marginBottom: 6 },
  reward: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 18,
    padding: 14,
    borderRadius: radii.lg,
    backgroundColor: colors.rewardTint,
    borderWidth: 1,
    borderColor: "#F6E2B0",
  },
  rewardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  detailsCard: {
    marginTop: 18,
    paddingHorizontal: 16,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14 },
  detailIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.sm,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 52 },
  section: { marginTop: 24 },
  sectionTitle: { marginBottom: 10 },
  person: { flexDirection: "row", alignItems: "center", gap: 12 },
  actionBar: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 12,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  reason: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  reasonSelected: { borderColor: colors.lost, backgroundColor: colors.lostTint },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: colors.lost, backgroundColor: colors.lost },
});
