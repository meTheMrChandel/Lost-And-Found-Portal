import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { radii } from "../theme/tokens";
import { haptics } from "./haptics";
import { Check, IconType } from "./icons";
import { PressableScale } from "./PressableScale";
import { Text } from "./Text";

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}

/** A panel that slides up from the bottom over a dimmed backdrop. */
export const BottomSheet: React.FC<BottomSheetProps> = ({ visible, onClose, title, subtitle, children }) => {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(progress, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, progress]);

  if (!mounted) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim, opacity: progress }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>
        <KeyboardAvoidingView behavior="padding" pointerEvents="box-none" style={styles.kav}>
          <Animated.View
            style={[
              styles.sheet,
              {
                maxHeight: height * 0.88,
                paddingBottom: insets.bottom + 18,
                transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }],
              },
            ]}
          >
            <View style={styles.handle} />
            {title ? (
              <View style={styles.header}>
                <Text variant="title3">{title}</Text>
                {subtitle ? (
                  <Text variant="footnote" color="textSecondary" style={{ marginTop: 4 }}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
            ) : null}
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

export interface SheetOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon?: IconType;
  iconColor?: string;
  iconBackground?: string;
  destructive?: boolean;
}

interface OptionSheetProps<T extends string> {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  options: SheetOption<T>[];
  selected?: T | null;
  onSelect: (value: T) => void;
}

/** A list of choices in a bottom sheet; the current one is ticked. */
export function OptionSheet<T extends string>({
  visible,
  onClose,
  title,
  subtitle,
  options,
  selected,
  onSelect,
}: OptionSheetProps<T>) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} subtitle={subtitle}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>
        {options.map((option) => {
          const Icon = option.icon;
          const isSelected = selected === option.value;
          const tint = option.destructive ? colors.danger : option.iconColor || colors.primary;
          return (
            <PressableScale
              key={option.value}
              scaleTo={0.98}
              onPress={() => {
                haptics.select();
                onSelect(option.value);
                onClose();
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              style={[styles.option, isSelected && styles.optionSelected]}
            >
              {Icon ? (
                <View
                  style={[
                    styles.optionIcon,
                    {
                      backgroundColor:
                        option.iconBackground || (option.destructive ? colors.dangerTint : colors.primaryTint),
                    },
                  ]}
                >
                  <Icon size={20} color={tint} strokeWidth={2} />
                </View>
              ) : null}
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium" color={option.destructive ? "danger" : "textPrimary"}>
                  {option.label}
                </Text>
                {option.description ? (
                  <Text variant="footnote" color="textSecondary" style={{ marginTop: 2 }}>
                    {option.description}
                  </Text>
                ) : null}
              </View>
              {isSelected ? <Check size={20} color={colors.primary} strokeWidth={2.6} /> : null}
            </PressableScale>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  kav: { justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: 14,
  },
  header: { marginBottom: 14 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginHorizontal: -8,
    borderRadius: radii.md,
  },
  optionSelected: { backgroundColor: colors.primaryTint },
  optionIcon: {
    width: 42,
    height: 42,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});
