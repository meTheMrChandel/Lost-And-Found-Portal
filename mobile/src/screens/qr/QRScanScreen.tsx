import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Linking, ScrollView, StyleSheet, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useIsFocused } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RootStackParamList } from "../../navigation/types";
import { goBackOrHome } from "../../navigation/goBackOrHome";
import { errorMessage } from "../../api/client";
import { chatApi } from "../../api/chat";
import { itemsApi, QRScanResult } from "../../api/items";
import { useAuth } from "../../context/AuthContext";
import { Avatar, Badge, Button, EmptyState, haptics, IconButton, Text, useToast } from "../../ui";
import {
  Camera,
  EyeOff,
  Flashlight,
  FlashlightOff,
  MessageCircle,
  PackageCheck,
  Pause,
  QrCode,
  ScanLine,
  ShieldCheck,
  X,
} from "../../ui/icons";
import { colors } from "../../theme/colors";
import { radii, SCREEN_PADDING } from "../../theme/tokens";
import { categoryIcon } from "../../utils/categories";

type Props = NativeStackScreenProps<RootStackParamList, "QRScan">;

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const FRAME = 248;

/** The line sweeping up and down the viewfinder. */
const ScanLineAnimation: React.FC = () => {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);
  return (
    <Animated.View
      style={[
        styles.sweep,
        { transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, FRAME - 14] }) }] },
      ]}
    />
  );
};

export const QRScanScreen: React.FC<Props> = ({ route, navigation }) => {
  const { user } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();

  const [torch, setTorch] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<QRScanResult | null>(null);
  const [openingChat, setOpeningChat] = useState(false);
  // Ignore further codes while one is being handled
  const busy = useRef(false);

  const lookup = useCallback(
    async (uuid: string) => {
      setChecking(true);
      try {
        const found = await itemsApi.scanQR(uuid);
        haptics.success();
        setResult(found);
      } catch (err: any) {
        haptics.error();
        toast.show(
          err?.response?.status === 404
            ? "This sticker isn't registered on Lost & Found."
            : errorMessage(err, "Couldn't check the sticker. Try again."),
          "error",
        );
        // Let the camera try again after the message has been seen
        setTimeout(() => (busy.current = false), 1500);
      } finally {
        setChecking(false);
      }
    },
    [toast],
  );

  // Opened from a sticker link: look the tag up directly, no camera needed
  useEffect(() => {
    const uuid = route.params?.uuid;
    if (uuid) {
      busy.current = true;
      lookup(uuid);
    }
  }, [route.params?.uuid, lookup]);

  // Ask for the camera once when the scanner opens; after a "no", the screen explains and
  // offers a button instead of asking again straight away
  const askedForCamera = useRef(false);
  useEffect(() => {
    if (!permission || permission.granted || !permission.canAskAgain || route.params?.uuid) return;
    if (askedForCamera.current) return;
    askedForCamera.current = true;
    requestPermission();
  }, [permission, requestPermission, route.params?.uuid]);

  const onScanned = ({ data }: { data: string }) => {
    if (busy.current || result) return;
    busy.current = true;
    // The sticker encodes a URL ending in /scan/<uuid> (a trailing slash or query is fine)
    const uuid = data.match(UUID_PATTERN)?.[0];
    if (!uuid) {
      haptics.error();
      toast.show("That QR code isn't a Lost & Found sticker.", "error");
      setTimeout(() => (busy.current = false), 1800);
      return;
    }
    lookup(uuid);
  };

  const scanAgain = () => {
    setResult(null);
    busy.current = false;
    navigation.setParams({ uuid: undefined });
  };

  const chatWithOwner = async () => {
    if (!result) return;
    setOpeningChat(true);
    try {
      const conv = await chatApi.openQRConversation(result.qr_uuid);
      navigation.navigate("Chat", { conversationId: conv.id, title: result.owner_name });
    } catch (err: any) {
      toast.show(errorMessage(err, "Couldn't open the chat."), "error");
    } finally {
      setOpeningChat(false);
    }
  };

  const reportFound = () => {
    if (!result) return;
    navigation.navigate("ReportFound", {
      title: `Found: ${result.item_name}`,
      category: result.category,
      qrUuid: result.qr_uuid,
    });
  };

  // ── The scan result ───────────────────────────────────────────────────────────
  if (result) {
    const CategoryIcon = categoryIcon(result.category);
    const active = result.is_active;
    return (
      <View style={[styles.result, { paddingTop: insets.top + 8 }]}>
        <StatusBar style="dark" />
        <View style={styles.resultTop}>
          <IconButton icon={X} variant="surface" accessibilityLabel="Close" onPress={() => goBackOrHome(navigation)} />
          <Text variant="headline">Sticker details</Text>
          <View style={{ width: 42 }} />
        </View>
        <ScrollView contentContainerStyle={[styles.resultBody, { paddingBottom: insets.bottom + 24 }]}>
          <View style={[styles.hero, { backgroundColor: active ? colors.primaryTint : colors.surfaceAlt }]}>
            <View style={[styles.heroIcon, { backgroundColor: active ? colors.primary : colors.textSecondary }]}>
              {active ? (
                <ShieldCheck size={30} color={colors.textWhite} />
              ) : (
                <Pause size={28} color={colors.textWhite} />
              )}
            </View>
            <Text variant="title3" align="center" style={{ marginTop: 14 }}>
              {result.is_owner ? "This is your item" : active ? "Registered on Lost & Found" : "This sticker is paused"}
            </Text>
            <Text variant="footnote" color="textSecondary" align="center" style={{ marginTop: 4, maxWidth: 290 }}>
              {result.is_owner
                ? active
                  ? "This is what anyone who scans the sticker sees. They can message you without seeing your contact details."
                  : "Your sticker is paused, so people who scan it are told to hand the item in at an office."
                : active
                  ? "This item belongs to someone on campus. Help it get back to them."
                  : "The owner has paused this sticker. If you found the item, hand it in at the admin or security office."}
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardRow}>
              <View style={styles.itemIcon}>
                <CategoryIcon size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="caption" color="textSecondary">
                  Item
                </Text>
                <Text variant="headline">{result.item_name}</Text>
              </View>
              <Badge label={result.category} />
            </View>
            <View style={styles.divider} />
            <View style={styles.cardRow}>
              <Avatar name={result.owner_name} size={42} />
              <View style={{ flex: 1 }}>
                <Text variant="caption" color="textSecondary">
                  Registered owner
                </Text>
                <Text variant="headline">{result.owner_name}</Text>
                {result.owner_registration_number ? (
                  <Text variant="footnote" color="textSecondary">
                    {result.owner_registration_number}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>

          {result.is_owner ? null : (
            <View style={styles.privacy}>
              <EyeOff size={15} color={colors.textMuted} />
              <Text variant="caption" color="textSecondary" style={{ flex: 1 }}>
                {user
                  ? "The owner's phone number and email stay private. Message them here instead."
                  : "The owner's contact details stay private. Sign in to message them."}
              </Text>
            </View>
          )}

          <View style={{ gap: 10, marginTop: 22 }}>
            {result.can_chat ? (
              <Button
                title="Message the owner"
                icon={MessageCircle}
                size="lg"
                fullWidth
                loading={openingChat}
                onPress={chatWithOwner}
              />
            ) : !user ? (
              <Button
                title="Sign in to message the owner"
                icon={MessageCircle}
                size="lg"
                fullWidth
                onPress={() => navigation.navigate("Auth")}
              />
            ) : null}
            {!result.is_owner && active ? (
              <Button
                title="Report it as found"
                icon={PackageCheck}
                variant={result.can_chat || !user ? "secondary" : "primary"}
                size="lg"
                fullWidth
                onPress={reportFound}
              />
            ) : null}
            {result.is_owner ? (
              <Button
                title="Manage my items"
                icon={QrCode}
                variant="secondary"
                size="lg"
                fullWidth
                onPress={() => navigation.navigate("Valuables")}
              />
            ) : null}
            <Button title="Scan another sticker" icon={ScanLine} variant="ghost" onPress={scanAgain} />
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Looking up a sticker from a link ─────────────────────────────────────────
  if (route.params?.uuid && checking) {
    return (
      <View style={[styles.result, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="callout" color="textSecondary" style={{ marginTop: 14 }}>
          Checking the sticker…
        </Text>
      </View>
    );
  }

  // ── Camera permission ────────────────────────────────────────────────────────
  if (!permission || !permission.granted) {
    const blocked = permission && !permission.canAskAgain;
    return (
      <View style={[styles.result, { paddingTop: insets.top + 8 }]}>
        <StatusBar style="dark" />
        <View style={styles.resultTop}>
          <IconButton icon={X} variant="surface" accessibilityLabel="Close" onPress={() => goBackOrHome(navigation)} />
        </View>
        {permission ? (
          <EmptyState
            icon={Camera}
            title="Allow camera access"
            body="The camera is only used to read QR stickers on campus items. Nothing is recorded."
            actionLabel={blocked ? "Open Settings" : "Allow camera"}
            onAction={() => (blocked ? Linking.openSettings() : requestPermission())}
            style={{ flex: 1 }}
          />
        ) : (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}
      </View>
    );
  }

  // ── The viewfinder ───────────────────────────────────────────────────────────
  return (
    <View style={styles.camera}>
      <StatusBar style="light" />
      {focused ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={onScanned}
        />
      ) : null}

      <View style={styles.mask} pointerEvents="none">
        <View style={styles.maskFill} />
        <View style={styles.maskRow}>
          <View style={styles.maskFill} />
          <View style={styles.frame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            {checking ? (
              <View style={styles.checking}>
                <ActivityIndicator color={colors.textWhite} />
              </View>
            ) : (
              <ScanLineAnimation />
            )}
          </View>
          <View style={styles.maskFill} />
        </View>
        <View style={[styles.maskFill, styles.hintArea]}>
          <Text variant="headline" color="textWhite" align="center">
            {checking ? "Checking the sticker…" : "Scan a Lost & Found sticker"}
          </Text>
          <Text variant="footnote" align="center" style={styles.hint}>
            Hold the QR code inside the frame. It scans automatically.
          </Text>
        </View>
      </View>

      <View style={[styles.cameraTop, { top: insets.top + 8 }]}>
        <IconButton icon={X} variant="overlay" accessibilityLabel="Close" onPress={() => goBackOrHome(navigation)} />
        <IconButton
          icon={torch ? FlashlightOff : Flashlight}
          variant="overlay"
          accessibilityLabel={torch ? "Turn off the torch" : "Turn on the torch"}
          onPress={() => setTorch((t) => !t)}
        />
      </View>
    </View>
  );
};

const CORNER = 30;
const MASK = "rgba(0,0,0,0.58)";

const styles = StyleSheet.create({
  camera: { flex: 1, backgroundColor: "#000" },
  mask: { ...StyleSheet.absoluteFill },
  maskFill: { flex: 1, backgroundColor: MASK },
  maskRow: { flexDirection: "row", height: FRAME },
  frame: { width: FRAME, height: FRAME },
  hintArea: { alignItems: "center", paddingTop: 28, paddingHorizontal: 32 },
  hint: { color: "rgba(255,255,255,0.75)", marginTop: 6 },
  corner: { position: "absolute", width: CORNER, height: CORNER, borderColor: colors.textWhite },
  topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 18 },
  topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 18 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 18 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 18 },
  sweep: {
    position: "absolute",
    left: 16,
    right: 16,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 4,
  },
  checking: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  cameraTop: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  result: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  resultTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  resultBody: { paddingHorizontal: SCREEN_PADDING, paddingTop: 8 },
  hero: { alignItems: "center", paddingVertical: 26, paddingHorizontal: 20, borderRadius: radii.xl },
  heroIcon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  card: {
    marginTop: 16,
    paddingHorizontal: 16,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14 },
  itemIcon: {
    width: 42,
    height: 42,
    borderRadius: radii.sm,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  privacy: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, paddingHorizontal: 4 },
});
