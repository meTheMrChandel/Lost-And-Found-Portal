import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, RefreshControl, Share, StyleSheet, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import { itemsApi, RegisteredValuable } from "../../api/items";
import { errorMessage } from "../../api/client";
import {
  Badge,
  BottomSheet,
  Button,
  Card,
  CardSkeleton,
  EmptyState,
  ErrorState,
  IconButton,
  Notice,
  OptionSheet,
  Text,
  useToast,
} from "../../ui";
import { EllipsisVertical, Pause, Play, Plus, QrCode, Share2, ShieldCheck, Trash2 } from "../../ui/icons";
import { colors } from "../../theme/colors";
import { radii, SCREEN_PADDING } from "../../theme/tokens";
import { categoryIcon } from "../../utils/categories";
import { formatDate } from "../../utils/format";

type Props = NativeStackScreenProps<RootStackParamList, "Valuables">;

/** The server's sticker is a standalone SVG sized in millimetres; keep just the drawing. */
function cleanSvg(svg: string): string {
  return svg
    .replace(/<\?xml[^>]*\?>/, "")
    .replace(/\s(width|height)="[^"]*"/g, "")
    .trim();
}

export const ValuablesScreen: React.FC<Props> = ({ navigation }) => {
  const toast = useToast();
  const [items, setItems] = useState<RegisteredValuable[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const loaded = useRef(false);

  const [menuFor, setMenuFor] = useState<RegisteredValuable | null>(null);
  const [stickerFor, setStickerFor] = useState<RegisteredValuable | null>(null);
  const [sticker, setSticker] = useState<{ svg: string; scan_url: string } | null>(null);
  const [stickerError, setStickerError] = useState("");

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <IconButton
          icon={Plus}
          variant="tonal"
          size={38}
          accessibilityLabel="Register an item"
          onPress={() => navigation.navigate("RegisterValuable")}
        />
      ),
    });
  }, [navigation]);

  const load = useCallback(async () => {
    try {
      setItems(await itemsApi.getRegisteredItems());
      setError("");
      loaded.current = true;
    } catch (err: any) {
      const message = errorMessage(err, "Couldn't load your items.");
      if (loaded.current) toast.show(message, "error");
      else setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openSticker = async (item: RegisteredValuable) => {
    setStickerFor(item);
    setSticker(null);
    setStickerError("");
    try {
      const data = await itemsApi.getSticker(item.id);
      setSticker({ svg: cleanSvg(data.svg), scan_url: data.scan_url });
    } catch (err: any) {
      setStickerError(errorMessage(err, "Couldn't load the sticker."));
    }
  };

  const toggle = async (item: RegisteredValuable) => {
    // Show the change straight away; undo it if the server says no
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_active: !i.is_active } : i)));
    try {
      await itemsApi.toggleActive(item.id);
      toast.show(item.is_active ? `${item.name}'s sticker is paused` : `${item.name}'s sticker is on again`);
    } catch (err: any) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_active: item.is_active } : i)));
      toast.show(errorMessage(err, "Couldn't update the sticker."), "error");
    }
  };

  const remove = (item: RegisteredValuable) => {
    Alert.alert(`Remove ${item.name}?`, "Its QR sticker will stop working. This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await itemsApi.deleteItem(item.id);
            setItems((prev) => prev.filter((i) => i.id !== item.id));
            toast.show(`${item.name} removed`);
          } catch (err: any) {
            toast.show(errorMessage(err, "Couldn't remove it."), "error");
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: RegisteredValuable }) => {
    const Icon = categoryIcon(item.category?.slug || item.category?.name);
    return (
      <Card style={styles.card}>
        <View style={styles.cardTop}>
          <View style={[styles.icon, !item.is_active && { backgroundColor: colors.surfaceAlt }]}>
            <Icon size={24} color={item.is_active ? colors.primary : colors.textMuted} strokeWidth={1.9} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="headline" numberOfLines={1}>
              {item.name}
            </Text>
            <Text variant="footnote" color="textSecondary" numberOfLines={1}>
              {item.category?.name || "Item"}
              {item.serial_number ? ` · Serial ${item.serial_number}` : ""}
            </Text>
          </View>
          <IconButton
            icon={EllipsisVertical}
            size={38}
            accessibilityLabel={`Options for ${item.name}`}
            onPress={() => setMenuFor(item)}
          />
        </View>
        {item.description ? (
          <Text variant="footnote" color="textSecondary" numberOfLines={2} style={{ marginTop: 10 }}>
            {item.description}
          </Text>
        ) : null}
        <View style={styles.cardBottom}>
          <Badge label={item.is_active ? "Sticker on" : "Paused"} tone={item.is_active ? "success" : "neutral"} dot />
          <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
            Added {formatDate(item.created_at)}
          </Text>
          <Button title="Show QR" icon={QrCode} size="sm" variant="tonal" onPress={() => openSticker(item)} />
        </View>
      </Card>
    );
  };

  if (loading) {
    return (
      <View style={[styles.screen, styles.list]}>
        {[0, 1, 2].map((i) => (
          <CardSkeleton key={i} thumb={false} />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          items.length ? (
            <Notice
              tone="neutral"
              icon={ShieldCheck}
              message="Stick a QR code on each item. Whoever finds it can scan it and message you, without seeing your phone number."
              style={{ marginBottom: 16 }}
            />
          ) : undefined
        }
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
        ListEmptyComponent={
          error ? (
            <ErrorState
              message={error}
              onRetry={() => {
                setLoading(true);
                load();
              }}
            />
          ) : (
            <EmptyState
              icon={QrCode}
              title="Protect your things with QR stickers"
              body="Register your bike, laptop or anything you carry around. If it's lost, whoever finds it can scan the sticker and message you."
              actionLabel="Register an item"
              onAction={() => navigation.navigate("RegisterValuable")}
            />
          )
        }
      />

      <OptionSheet
        visible={!!menuFor}
        onClose={() => setMenuFor(null)}
        title={menuFor?.name}
        options={
          menuFor
            ? [
                menuFor.is_active
                  ? { value: "toggle", label: "Pause sticker", description: "Scans will say it's paused", icon: Pause }
                  : { value: "toggle", label: "Turn sticker back on", icon: Play },
                { value: "share", label: "Share sticker link", icon: Share2 },
                {
                  value: "delete",
                  label: "Remove item",
                  description: "Its sticker stops working",
                  icon: Trash2,
                  destructive: true,
                },
              ]
            : []
        }
        onSelect={(choice) => {
          const item = menuFor;
          if (!item) return;
          if (choice === "toggle") toggle(item);
          else if (choice === "share") Share.share({ message: `${item.name}: ${item.scan_url}` }).catch(() => {});
          else setTimeout(() => remove(item), 250);
        }}
      />

      <BottomSheet
        visible={!!stickerFor}
        onClose={() => setStickerFor(null)}
        title={stickerFor?.name}
        subtitle="Print this and stick it somewhere visible."
      >
        <View style={styles.stickerCard}>
          {sticker ? (
            <SvgXml xml={sticker.svg} width={210} height={210} />
          ) : stickerError ? (
            <Text variant="footnote" color="danger" align="center">
              {stickerError}
            </Text>
          ) : (
            <ActivityIndicator color={colors.primary} />
          )}
          <Text variant="overline" color="textSecondary" style={{ marginTop: 12 }}>
            Found this? Scan me
          </Text>
          <Text variant="caption" color="textMuted">
            IIT Ropar Lost & Found
          </Text>
        </View>
        {stickerFor && !stickerFor.is_active ? (
          <Notice
            tone="warning"
            message="This sticker is paused. Scans will say so until you turn it back on."
            style={{ marginTop: 14 }}
          />
        ) : null}
        <Button
          title="Share sticker link"
          icon={Share2}
          size="lg"
          fullWidth
          disabled={!sticker}
          onPress={() =>
            sticker && stickerFor && Share.share({ message: `${stickerFor.name}: ${sticker.scan_url}` }).catch(() => {})
          }
          style={{ marginTop: 18 }}
        />
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: SCREEN_PADDING, paddingTop: 12, paddingBottom: 32, flexGrow: 1 },
  card: { marginBottom: 12, padding: 14 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBottom: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 },
  stickerCard: {
    alignItems: "center",
    alignSelf: "center",
    padding: 18,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minWidth: 250,
    minHeight: 250,
    justifyContent: "center",
  },
});
