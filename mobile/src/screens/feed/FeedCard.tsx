import React, { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Post } from "../../api/posts";
import { Badge, Card, Text } from "../../ui";
import { CalendarClock, Gift, MapPin } from "../../ui/icons";
import { colors } from "../../theme/colors";
import { radii } from "../../theme/tokens";
import { categoryIcon } from "../../utils/categories";
import { formatDate, formatRupees } from "../../utils/format";

/** Photo of the item, or its category icon on a tinted tile when there's no photo. */
export const ItemThumb: React.FC<{ post: Pick<Post, "images" | "post_type" | "category">; size: number }> = ({
  post,
  size,
}) => {
  const photo = post.images?.[0]?.image_url;
  const isLost = post.post_type === "lost";
  if (photo) {
    return (
      <Image
        source={{ uri: photo }}
        style={{ width: size, height: size, borderRadius: radii.md, backgroundColor: colors.surfaceAlt }}
        contentFit="cover"
        transition={200}
        cachePolicy="memory-disk"
        recyclingKey={photo}
        accessibilityIgnoresInvertColors
      />
    );
  }
  const Icon = categoryIcon(typeof post.category === "string" ? post.category : post.category?.slug);
  return (
    <View
      style={[
        styles.placeholder,
        { width: size, height: size, backgroundColor: isLost ? colors.lostTint : colors.primaryTint },
      ]}
    >
      <Icon size={size * 0.36} color={isLost ? colors.lost : colors.primary} strokeWidth={1.7} />
    </View>
  );
};

interface FeedCardProps {
  post: Post;
  onPress: (post: Post) => void;
  /** Faded while a new search or filter loads, so it reads as out of date. */
  dimmed?: boolean;
}

/** A lost or found report in the feed. */
export const FeedCard = memo<FeedCardProps>(({ post, onPress, dimmed }) => {
  const isLost = post.post_type === "lost";
  const pending = post.status && post.status !== "APPROVED";
  return (
    <Card
      onPress={() => onPress(post)}
      padded={false}
      style={[styles.card, dimmed && styles.dimmed]}
      accessibilityLabel={`${isLost ? "Lost" : "Found"}: ${post.title}, ${post.campus_location}`}
    >
      <ItemThumb post={post} size={92} />
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Badge label={isLost ? "Lost" : "Found"} tone={isLost ? "danger" : "success"} dot />
          {pending ? <Badge label="In review" tone="warning" /> : null}
          <View style={{ flex: 1 }} />
          {isLost && post.reward_amount ? (
            <Badge label={formatRupees(post.reward_amount)} tone="reward" icon={Gift} />
          ) : null}
        </View>
        <Text variant="headline" numberOfLines={2} style={styles.title}>
          {post.title}
        </Text>
        <View style={styles.meta}>
          <MapPin size={14} color={colors.textMuted} strokeWidth={2} />
          <Text variant="footnote" color="textSecondary" numberOfLines={1} style={{ flex: 1 }}>
            {post.campus_location}
          </Text>
        </View>
        <View style={styles.meta}>
          <CalendarClock size={14} color={colors.textMuted} strokeWidth={2} />
          <Text variant="footnote" color="textSecondary" numberOfLines={1} style={{ flex: 1 }}>
            {isLost ? "Lost" : "Found"} {formatDate(post.incident_date)}
            {post.category_name ? ` · ${post.category_name}` : ""}
          </Text>
        </View>
      </View>
    </Card>
  );
});
FeedCard.displayName = "FeedCard";

const styles = StyleSheet.create({
  card: { flexDirection: "row", gap: 14, padding: 12, marginBottom: 12 },
  dimmed: { opacity: 0.45 },
  placeholder: { borderRadius: radii.md, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, minWidth: 0 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  title: { marginBottom: 6 },
  meta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
});
