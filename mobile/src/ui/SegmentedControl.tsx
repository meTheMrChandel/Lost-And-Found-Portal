import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { colors } from "../theme/colors";
import { radii } from "../theme/tokens";
import { haptics } from "./haptics";
import { Text } from "./Text";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** Text colour when this segment is selected. */
  activeColor?: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}

const PAD = 4;

/** Two to four mutually exclusive options with a sliding highlight. */
export function SegmentedControl<T extends string>({ options, value, onChange, style }: SegmentedControlProps<T>) {
  const [width, setWidth] = useState(0);
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const position = useRef(new Animated.Value(index)).current;

  useEffect(() => {
    Animated.spring(position, { toValue: index, useNativeDriver: true, speed: 22, bounciness: 3 }).start();
  }, [index, position]);

  const segment = width > 0 ? (width - PAD * 2) / options.length : 0;

  return (
    <View
      style={[styles.track, style]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
    >
      {segment > 0 ? (
        <Animated.View
          style={[
            styles.thumb,
            {
              width: segment,
              transform: [
                {
                  translateX: position.interpolate({
                    inputRange: [0, Math.max(1, options.length - 1)],
                    outputRange: [0, segment * Math.max(1, options.length - 1)],
                  }),
                },
              ],
            },
          ]}
        />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={styles.segment}
            onPress={() => {
              if (selected) return;
              haptics.select();
              onChange(option.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
          >
            <Text
              style={[
                styles.label,
                selected
                  ? { color: option.activeColor || colors.textPrimary, fontWeight: "600" }
                  : { color: colors.textSecondary, fontWeight: "500" },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    height: 42,
    padding: PAD,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
  },
  thumb: {
    position: "absolute",
    top: PAD,
    bottom: PAD,
    left: PAD,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segment: { flex: 1, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 14, lineHeight: 18 },
});
