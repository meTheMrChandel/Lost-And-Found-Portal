import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import { apiClient } from "../../api/client";
import { postsApi, Post } from "../../api/posts";
import { useAuth } from "../../context/AuthContext";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { colors } from "../../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "ItemDetail">;

export const ItemDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { user } = useAuth();
  const { postId } = route.params;
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [reportingAbuse, setReportingAbuse] = useState<boolean>(false);

  useEffect(() => {
    const loadPost = async () => {
      try {
        const res = await apiClient.get(`/posts/${postId}/`);
        setPost(res.data?.data || res.data);
      } catch (e: any) {
        Alert.alert("Error", e.message || "Failed to load item details");
      } finally {
        setLoading(false);
      }
    };
    loadPost();
  }, [postId]);

  const handleReportAbuse = () => {
    Alert.prompt(
      "Report Inappropriate Content",
      "Please enter the reason for reporting this post:",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit",
          onPress: async (reason) => {
            if (!reason) return;
            setReportingAbuse(true);
            try {
              await postsApi.reportAbuse(postId, reason);
              Alert.alert("Report Received", "Thank you. Our campus moderation team will review this listing.");
            } catch (err: any) {
              Alert.alert("Error", err.formattedMessage || "Failed to submit abuse report.");
            } finally {
              setReportingAbuse(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading item details...</Text>
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Item not found or has been removed.</Text>
      </View>
    );
  }

  const isLost = post.post_type === "lost";

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Photos Carousel */}
        {post.images && post.images.length > 0 ? (
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
            {post.images.map((img) => (
              <Image key={img.id} source={{ uri: img.image_url }} style={styles.bannerImage} />
            ))}
          </ScrollView>
        ) : (
          <View style={[styles.placeholderBanner, { backgroundColor: isLost ? colors.lostLight : colors.foundLight }]}>
            <Text style={styles.placeholderEmoji}>{isLost ? "🔍" : "📦"}</Text>
          </View>
        )}

        <View style={styles.contentCard}>
          {/* Top Badges */}
          <View style={styles.badgeRow}>
            <Badge label={post.post_type.toUpperCase()} variant={isLost ? "lost" : "found"} />
            <Badge label={post.status.replace("_", " ")} variant="info" />
            {post.reward_amount ? (
              <View style={styles.rewardChip}>
                <Text style={styles.rewardText}>🏆 ₹{post.reward_amount} Reward</Text>
              </View>
            ) : null}
          </View>

          {/* Title & Category */}
          <Text style={styles.title}>{post.title}</Text>
          <Text style={styles.category}>{post.category?.name || "General Item"}</Text>

          {/* Location & Date Card */}
          <View style={styles.metaBox}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>CAMPUS LOCATION</Text>
              <Text style={styles.metaValue}>📍 {post.campus_location || "IIT Ropar"}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>INCIDENT DATE</Text>
              <Text style={styles.metaValue}>
                📅 {new Date(post.incident_date).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
              </Text>
            </View>
          </View>

          {/* Description */}
          <Text style={styles.sectionHeader}>Description & Identifiers</Text>
          <Text style={styles.description}>{post.description}</Text>

          {/* Reporter Information */}
          <Text style={styles.sectionHeader}>Reported By</Text>
          <View style={styles.reporterBox}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{post.author?.full_name?.charAt(0) || "U"}</Text>
            </View>
            <View>
              <Text style={styles.reporterName}>{post.author?.full_name || "Campus Resident"}</Text>
              <Text style={styles.reporterReg}>{post.author?.registration_number}</Text>
            </View>
          </View>

          {/* Safety & Action Controls */}
          <View style={styles.actionSection}>
            <Button
              title="💬 Open Campus Chat"
              variant="ocean"
              onPress={() => {
                if (!user) {
                  Alert.alert(
                    "Sign In Required",
                    "Please sign in with your IIT Ropar institute account to chat with the finder or claim this item.",
                    [
                      { text: "Cancel", style: "cancel" },
                      { text: "Sign In", onPress: () => navigation.navigate("Auth") },
                    ]
                  );
                  return;
                }
                navigation.navigate("Chat", { conversationId: post.id, title: post.title });
              }}
              style={styles.actionBtn}
            />

            <TouchableOpacity onPress={handleReportAbuse} style={styles.abuseBtn}>
              <Text style={styles.abuseText}>🚩 Report Inappropriate Listing</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 12,
    color: colors.textSecondary,
  },
  errorText: {
    color: colors.lost,
    fontSize: 14,
    fontWeight: "bold",
  },
  imageScroll: {
    height: 280,
  },
  bannerImage: {
    width: 380,
    height: 280,
    resizeMode: "cover",
  },
  placeholderBanner: {
    height: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderEmoji: {
    fontSize: 54,
  },
  contentCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: -20,
    padding: 24,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginBottom: 12,
  },
  rewardChip: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  rewardText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#B45309",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  category: {
    fontSize: 13,
    color: colors.ocean,
    fontWeight: "600",
    marginTop: 2,
    marginBottom: 16,
  },
  metaBox: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: 10,
    marginBottom: 6,
  },
  description: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  reporterBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardSubtle,
    padding: 12,
    borderRadius: 14,
    gap: 12,
    marginBottom: 24,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.textWhite,
    fontSize: 16,
    fontWeight: "bold",
  },
  reporterName: {
    fontSize: 13,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  reporterReg: {
    fontSize: 11,
    color: colors.textMuted,
  },
  actionSection: {
    marginTop: 10,
  },
  actionBtn: {
    marginBottom: 14,
  },
  abuseBtn: {
    alignSelf: "center",
  },
  abuseText: {
    fontSize: 12,
    color: colors.lost,
    fontWeight: "600",
  },
});
