import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { radii, shadows } from "../theme/tokens";
import { haptics } from "./haptics";
import { CircleAlert, CircleCheck, Info } from "./icons";
import { Text } from "./Text";

type ToastKind = "success" | "error" | "info";

interface ToastApi {
  show: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastApi>({ show: () => {} });

const KINDS = {
  success: { icon: CircleCheck, color: "#34D399" },
  error: { icon: CircleAlert, color: "#FF8A75" },
  info: { icon: Info, color: "#7DD3FC" },
};

/** Short confirmations that slide in at the top and leave on their own. */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<{ message: string; kind: ToastKind; key: number } | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(progress, { toValue: 0, duration: 180, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setToast(null);
    });
  }, [progress]);

  const show = useCallback(
    (message: string, kind: ToastKind = "success") => {
      if (timer.current) clearTimeout(timer.current);
      if (kind === "error") haptics.error();
      setToast({ message, kind, key: Date.now() });
      progress.setValue(0);
      Animated.spring(progress, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 5 }).start();
      timer.current = setTimeout(hide, kind === "error" ? 4500 : 3000);
    },
    [hide, progress],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const api = useMemo(() => ({ show }), [show]);
  const kind = toast ? KINDS[toast.kind] : null;
  const Icon = kind?.icon;

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast && Icon ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.wrap,
            {
              top: insets.top + 10,
              opacity: progress,
              transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }],
            },
          ]}
        >
          <Pressable onPress={hide} style={styles.toast} accessibilityRole="alert" accessibilityLiveRegion="polite">
            <Icon size={20} color={kind!.color} strokeWidth={2.2} />
            <View style={{ flex: 1 }}>
              <Text variant="calloutMedium" color="textWhite">
                {toast.message}
              </Text>
            </View>
          </Pressable>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, alignItems: "center", zIndex: 1000, elevation: 20 },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "100%",
    maxWidth: 520,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radii.md,
    backgroundColor: colors.charcoal,
    ...shadows.raised,
  },
});
