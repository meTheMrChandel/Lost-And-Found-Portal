import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Platform, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useNavigation, useScrollToTop } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RootStackParamList } from "../../navigation/types";
import { Category, Post, postsApi } from "../../api/posts";
import { errorMessage } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useActivity } from "../../context/ActivityContext";
import {
  CardSkeleton,
  Chip,
  EmptyState,
  ErrorState,
  IconButton,
  Logo,
  SearchField,
  SegmentedControl,
  Text,
  useToast,
} from "../../ui";
import { Bell, PackageSearch, ScanLine, SearchX } from "../../ui/icons";
import { colors } from "../../theme/colors";
import { SCREEN_PADDING } from "../../theme/tokens";
import { categoryIcon } from "../../utils/categories";
import { FeedCard } from "./FeedCard";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type TypeFilter = "all" | "lost" | "found";

const SEARCH_DELAY_MS = 350;

export const FeedScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { user } = useAuth();
  const { unreadNotifications } = useActivity();

  const listRef = useRef<FlatList<Post>>(null);
  useScrollToTop(listRef);

  const [categories, setCategories] = useState<Category[]>([]);
  const [type, setType] = useState<TypeFilter>("all");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  // Only the newest request may change the list, so a slow older search can't overwrite it
  const latest = useRef(0);
  const postsRef = useRef(posts);
  postsRef.current = posts;

  useEffect(() => {
    const timer = setTimeout(() => setAppliedSearch(search.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    postsApi
      .getCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  const filters = useMemo(
    () => ({
      ...(type !== "all" ? { post_type: type.toUpperCase() as "LOST" | "FOUND" } : {}),
      ...(category !== "all" ? { category } : {}),
      ...(appliedSearch ? { search: appliedSearch } : {}),
    }),
    [type, category, appliedSearch],
  );

  const loadFirstPage = useCallback(
    async (mode: "initial" | "refresh") => {
      const request = ++latest.current;
      if (mode === "initial") setLoading(true);
      try {
        const result = await postsApi.getFeedPage({ ...filters, page: 1 });
        if (request !== latest.current) return;
        setPosts(result.posts);
        setHasMore(result.hasNext);
        setPage(1);
        setError("");
      } catch (err: any) {
        if (request !== latest.current) return;
        const message = errorMessage(err, "Couldn't load the feed.");
        // Keep what's on screen after a failed refresh; only an empty list shows the error page
        if (mode === "refresh" && postsRef.current.length) {
          toast.show(message, "error");
        } else {
          setPosts([]);
          setError(message);
        }
      } finally {
        if (request === latest.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [filters, toast],
  );

  useEffect(() => {
    loadFirstPage("initial");
  }, [loadFirstPage]);

  const loadMore = async () => {
    if (!hasMore || loadingMore || loading || refreshing) return;
    const request = latest.current;
    setLoadingMore(true);
    try {
      const result = await postsApi.getFeedPage({ ...filters, page: page + 1 });
      if (request !== latest.current) return;
      setPosts((current) => {
        const known = new Set(current.map((p) => p.id));
        return [...current, ...result.posts.filter((p) => !known.has(p.id))];
      });
      setHasMore(result.hasNext);
      setPage((p) => p + 1);
    } catch (err: any) {
      toast.show(errorMessage(err, "Couldn't load more reports."), "error");
    } finally {
      setLoadingMore(false);
    }
  };

  const openPost = useCallback((post: Post) => navigation.navigate("ItemDetail", { postId: post.id }), [navigation]);
  const filtered = type !== "all" || category !== "all" || !!appliedSearch;

  const clearFilters = () => {
    setType("all");
    setCategory("all");
    setSearch("");
    setAppliedSearch("");
  };

  const header = (
    <View style={styles.filters}>
      <SegmentedControl<TypeFilter>
        value={type}
        onChange={setType}
        options={[
          { value: "all", label: "All" },
          { value: "lost", label: "Lost", activeColor: colors.lost },
          { value: "found", label: "Found", activeColor: colors.primary },
        ]}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipScroller}
      >
        <Chip label="All items" selected={category === "all"} onPress={() => setCategory("all")} />
        {categories.map((c) => (
          <Chip
            key={c.slug}
            label={c.name}
            icon={categoryIcon(c.slug)}
            selected={category === c.slug}
            onPress={() => setCategory(c.slug)}
          />
        ))}
      </ScrollView>
    </View>
  );

  const renderBody = () => {
    if (loading && posts.length === 0) {
      return (
        <View style={styles.list}>
          {header}
          {[0, 1, 2, 3, 4].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </View>
      );
    }
    return (
      <FlatList
        ref={listRef}
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <FeedCard post={item} onPress={openPost} dimmed={loading} />}
        extraData={loading}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={9}
        removeClippedSubviews={Platform.OS === "android"}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadFirstPage("refresh");
            }}
            colors={[colors.primary]}
            tintColor={colors.primary}
            progressBackgroundColor={colors.surface}
          />
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
          ) : posts.length > 0 && !hasMore ? (
            <Text variant="caption" color="textMuted" align="center" style={{ marginVertical: 18 }}>
              You're all caught up
            </Text>
          ) : undefined
        }
        ListEmptyComponent={
          error ? (
            <ErrorState message={error} onRetry={() => loadFirstPage("initial")} />
          ) : filtered ? (
            <EmptyState
              icon={SearchX}
              tone="neutral"
              title="No matching items"
              body={
                appliedSearch
                  ? `Nothing matches "${appliedSearch}" with these filters.`
                  : "Nothing matches these filters yet."
              }
              actionLabel="Clear filters"
              onAction={clearFilters}
            />
          ) : (
            <EmptyState
              icon={PackageSearch}
              title="No reports yet"
              body="When someone on campus reports a lost or found item, it shows up here."
              actionLabel="Report an item"
              onAction={() => navigation.navigate("ReportLost")}
            />
          )
        }
      />
    );
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.brandRow}>
          <Logo size={40} />
          <View style={{ flex: 1 }}>
            <Text variant="title3" style={{ fontWeight: "700" }}>
              Lost & Found
            </Text>
            <Text variant="caption" color="textSecondary">
              IIT Ropar campus
            </Text>
          </View>
          <IconButton
            icon={ScanLine}
            variant="surface"
            accessibilityLabel="Scan a QR sticker"
            onPress={() => navigation.navigate("QRScan")}
          />
          <IconButton
            icon={Bell}
            variant="surface"
            accessibilityLabel={unreadNotifications ? `Notifications, ${unreadNotifications} unread` : "Notifications"}
            badge={unreadNotifications}
            onPress={() => (user ? navigation.navigate("Notifications") : navigation.navigate("Auth"))}
          />
        </View>
        <SearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Search items, places, descriptions"
          onSubmitEditing={() => {
            const query = search.trim();
            if (query === appliedSearch) loadFirstPage("initial");
            else setAppliedSearch(query);
          }}
        />
      </View>
      {renderBody()}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: 12,
    gap: 14,
    backgroundColor: colors.background,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  filters: { paddingTop: 4, paddingBottom: 14 },
  chipScroller: { marginHorizontal: -SCREEN_PADDING, marginTop: 12 },
  chips: { gap: 8, paddingHorizontal: SCREEN_PADDING },
  list: { paddingHorizontal: SCREEN_PADDING, paddingBottom: 28, flexGrow: 1 },
});
