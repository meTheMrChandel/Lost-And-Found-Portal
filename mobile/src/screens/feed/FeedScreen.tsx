import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Image,
  ActivityIndicator,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { RootStackParamList } from "../../navigation/types";
import { postsApi, Post, Category } from "../../api/posts";
import { CategoryChip } from "../../components/CategoryChip";
import { Badge } from "../../components/Badge";
import { colors } from "../../theme/colors";

export const FeedScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedType, setSelectedType] = useState<"all" | "lost" | "found">("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Fetch categories
  useEffect(() => {
    postsApi.getCategories().then(setCategories).catch(console.error);
  }, []);

  // Fetch feed items
  const loadPosts = useCallback(async () => {
    try {
      const params: any = {};
      if (selectedType !== "all") {
        params.post_type = selectedType.toUpperCase();
        params.type = selectedType.toUpperCase();
      }
      if (selectedCategory !== "all") params.category = selectedCategory;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const data = await postsApi.getFeed(params);
      setPosts(data);
    } catch (e) {
      console.error("Failed to load feed", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedType, selectedCategory, searchQuery]);

  useEffect(() => {
    setLoading(true);
    loadPosts();
  }, [loadPosts]);

  const onRefresh = () => {
    setRefreshing(true);
    loadPosts();
  };

  const renderPostItem = ({ item }: { item: Post }) => {
    const isLost = item.post_type === "lost";
    const primaryImg = item.images && item.images.length > 0 ? item.images[0].image_url : null;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => navigation.navigate("ItemDetail", { postId: item.id })}
      >
        {primaryImg ? (
          <Image source={{ uri: primaryImg }} style={styles.cardImage} />
        ) : (
          <View style={[styles.cardImagePlaceholder, { backgroundColor: isLost ? colors.lostLight : colors.foundLight }]}>
            <Text style={styles.placeholderEmoji}>{isLost ? "🔍" : "📦"}</Text>
          </View>
        )}

        <View style={styles.cardContent}>
          <View style={styles.topRow}>
            <Badge
              label={item.post_type.toUpperCase()}
              variant={isLost ? "lost" : "found"}
            />
            {item.reward_amount ? (
              <View style={styles.rewardChip}>
                <Text style={styles.rewardText}>🏆 ₹{item.reward_amount}</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.title}
          </Text>

          <Text style={styles.cardDesc} numberOfLines={2}>
            {item.description}
          </Text>

          <View style={styles.bottomMeta}>
            <Text style={styles.metaText}>📍 {item.campus_location || "IIT Ropar Campus"}</Text>
            <Text style={styles.metaText}>
              📅 {new Date(item.incident_date).toLocaleDateString([], { month: "short", day: "numeric" })}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search bicycles, IDs, keys, electronics..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          onSubmitEditing={loadPosts}
        />
      </View>

      {/* Post Type Toggle (All, Lost, Found) */}
      <View style={styles.typeToggleRow}>
        {(["all", "lost", "found"] as const).map((type) => (
          <TouchableOpacity
            key={type}
            onPress={() => setSelectedType(type)}
            style={[
              styles.typeTab,
              selectedType === type && styles.typeTabActive,
              type === "lost" && selectedType === "lost" && styles.typeTabLost,
              type === "found" && selectedType === "found" && styles.typeTabFound,
            ]}
          >
            <Text
              style={[
                styles.typeTabText,
                selectedType === type && styles.typeTabTextActive,
              ]}
            >
              {type === "all" ? "All Belongings" : type === "lost" ? "Lost Items" : "Found Items"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Category Horizontal Filter Scroller */}
      <View style={styles.categoriesContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: "all", slug: "all", name: "All Categories" }, ...categories]}
          keyExtractor={(item) => item.slug}
          contentContainerStyle={styles.categoryList}
          renderItem={({ item }) => (
            <CategoryChip
              label={item.name}
              selected={selectedCategory === item.slug}
              onPress={() => setSelectedCategory(item.slug)}
            />
          )}
        />
      </View>

      {/* Feed List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Fetching campus feed...</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderPostItem}
          contentContainerStyle={styles.feedList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🍃</Text>
              <Text style={styles.emptyTitle}>No Belongings Listed</Text>
              <Text style={styles.emptySubtitle}>
                No items match your active search or filters. Check back soon or submit a report.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchInput: {
    height: 44,
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 18,
    fontSize: 13,
    color: colors.textPrimary,
  },
  typeToggleRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
  },
  typeTab: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  typeTabActive: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  typeTabLost: {
    backgroundColor: colors.lost,
    borderColor: colors.lost,
  },
  typeTabFound: {
    backgroundColor: colors.found,
    borderColor: colors.found,
  },
  typeTabText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  typeTabTextActive: {
    color: colors.textWhite,
  },
  categoriesContainer: {
    paddingVertical: 6,
  },
  categoryList: {
    paddingHorizontal: 16,
  },
  feedList: {
    padding: 16,
    paddingTop: 8,
    gap: 14,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: "hidden",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    flexDirection: "row",
  },
  cardImage: {
    width: 110,
    height: 110,
    backgroundColor: colors.cardSubtle,
  },
  cardImagePlaceholder: {
    width: 110,
    height: 110,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderEmoji: {
    fontSize: 32,
  },
  cardContent: {
    flex: 1,
    padding: 12,
    justifyContent: "space-between",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rewardChip: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rewardText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#B45309",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginTop: 4,
  },
  cardDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  bottomMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  metaText: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: "500",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 12,
    color: colors.textSecondary,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    marginTop: 30,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
});
