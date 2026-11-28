import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Image } from "expo-image";
import { colors } from "../theme/colors";
import { IconType } from "./icons";
import { Text } from "./Text";

const TINTS = [
  { bg: colors.primarySoft, fg: colors.primaryPressed },
  { bg: colors.infoSoft, fg: colors.info },
  { bg: colors.warningSoft, fg: colors.warning },
  { bg: colors.lostSoft, fg: colors.lostPressed },
  { bg: "#E9E3FB", fg: "#5B3FB8" },
];

export function initials(name?: string | null): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function tintFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return TINTS[Math.abs(hash) % TINTS.length];
}

interface AvatarProps {
  name?: string | null;
  uri?: string | null;
  size?: number;
  /** Shown instead of initials, e.g. for the admin office. */
  icon?: IconType;
  style?: StyleProp<ViewStyle>;
}

/** A round photo, or initials on a colour picked from the name. */
export const Avatar: React.FC<AvatarProps> = ({ name, uri, size = 44, icon: Icon, style }) => {
  const tint = Icon ? { bg: colors.charcoal, fg: colors.textWhite } : tintFor(name || "?");
  const round = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[round, styles.photo, style as any]}
        contentFit="cover"
        transition={150}
        cachePolicy="memory-disk"
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View style={[styles.base, round, { backgroundColor: tint.bg }, style]}>
      {Icon ? (
        <Icon size={size * 0.48} color={tint.fg} strokeWidth={2} />
      ) : (
        <Text style={{ color: tint.fg, fontSize: size * 0.38, lineHeight: size * 0.46, fontWeight: "600" }}>
          {initials(name)}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center" },
  photo: { backgroundColor: colors.surfaceAlt },
});
