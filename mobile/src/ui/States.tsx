import React, { useEffect } from "react";
import { Animated, Easing, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { colors } from "../theme/colors";
import { radii } from "../theme/tokens";
import { Button } from "./Button";
import { CircleAlert, CircleCheck, IconType, Info, RefreshCw, TriangleAlert, WifiOff } from "./icons";
import { PressableScale } from "./PressableScale";
import { Text } from "./Text";

interface EmptyStateProps {
  icon: IconType;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: "brand" | "danger" | "neutral";
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}

const EMPTY_TONES = {
  brand: { bg: colors.primaryTint, fg: colors.primary },
  danger: { bg: colors.lostTint, fg: colors.lost },
  neutral: { bg: colors.surfaceAlt, fg: colors.textSecondary },
};

/** Centred icon, message and optional action for empty lists and dead ends. */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  body,
  actionLabel,
  onAction,
  tone = "brand",
  style,
  compact,
}) => {
  const palette = EMPTY_TONES[tone];
  return (
    <View style={[styles.empty, compact && styles.emptyCompact, style]}>
      <View style={[styles.emptyIcon, { backgroundColor: palette.bg }]}>
        <Icon size={30} color={palette.fg} strokeWidth={1.8} />
      </View>
      <Text variant="title3" align="center">
        {title}
      </Text>
      {body ? (
        <Text variant="callout" color="textSecondary" align="center" style={styles.emptyBody}>
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} style={styles.emptyAction} /> : null}
    </View>
  );
};

/** A failed load, with a retry. Offline and timeout messages get the no-signal icon. */
export const ErrorState: React.FC<{ message: string; onRetry?: () => void; style?: StyleProp<ViewStyle> }> = ({
  message,
  onRetry,
  style,
}) => {
  const offline = /reach the server|too long|connection/i.test(message);
  return (
    <EmptyState
      icon={offline ? WifiOff : CircleAlert}
      tone="danger"
      title={offline ? "You're not connected" : "Something went wrong"}
      body={message}
      actionLabel={onRetry ? "Try again" : undefined}
      onAction={onRetry}
      style={style}
    />
  );
};

type NoticeTone = "info" | "warning" | "danger" | "success" | "neutral";

const NOTICE_TONES: Record<NoticeTone, { bg: string; fg: string; border: string; icon: IconType }> = {
  info: { bg: colors.infoTint, fg: colors.info, border: colors.infoSoft, icon: Info },
  warning: { bg: colors.warningTint, fg: colors.warning, border: colors.warningSoft, icon: TriangleAlert },
  danger: { bg: colors.lostTint, fg: colors.lost, border: colors.lostSoft, icon: CircleAlert },
  success: { bg: colors.primaryTint, fg: colors.primary, border: colors.primarySoft, icon: CircleCheck },
  neutral: { bg: colors.surfaceAlt, fg: colors.textSecondary, border: colors.border, icon: Info },
};

interface NoticeProps {
  tone?: NoticeTone;
  title?: string;
  message: string;
  icon?: IconType;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** An inline message box: errors under a form, hints, status explanations. */
export const Notice: React.FC<NoticeProps> = ({
  tone = "info",
  title,
  message,
  icon,
  actionLabel,
  onAction,
  style,
}) => {
  const palette = NOTICE_TONES[tone];
  const Icon = icon || palette.icon;
  return (
    <View style={[styles.notice, { backgroundColor: palette.bg, borderColor: palette.border }, style]}>
      <Icon size={18} color={palette.fg} strokeWidth={2.2} style={styles.noticeIcon} />
      <View style={{ flex: 1, gap: 2 }}>
        {title ? (
          <Text variant="subhead" style={{ color: palette.fg }}>
            {title}
          </Text>
        ) : null}
        <Text variant="footnote" style={{ color: tone === "neutral" ? colors.textSecondary : colors.textPrimary }}>
          {message}
        </Text>
        {actionLabel && onAction ? (
          <PressableScale onPress={onAction} style={styles.noticeAction} accessibilityRole="button">
            <Text variant="subhead" style={{ color: palette.fg }}>
              {actionLabel}
            </Text>
            {actionLabel.toLowerCase().includes("try") ? <RefreshCw size={14} color={palette.fg} /> : null}
          </PressableScale>
        ) : null}
      </View>
    </View>
  );
};

// One shared pulse keeps every skeleton on screen in step
const pulse = new Animated.Value(0);
let pulseUsers = 0;
let pulseLoop: Animated.CompositeAnimation | null = null;

function startPulse() {
  pulseUsers += 1;
  if (pulseUsers === 1) {
    pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    pulseLoop.start();
  }
}

function stopPulse() {
  pulseUsers -= 1;
  if (pulseUsers === 0) {
    pulseLoop?.stop();
    pulseLoop = null;
  }
}

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** A placeholder block that gently pulses while content loads. */
export const Skeleton: React.FC<SkeletonProps> = ({ width = "100%", height = 14, radius = 8, style }) => {
  useEffect(() => {
    startPulse();
    return stopPulse;
  }, []);
  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: "#EAE4D8",
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
        },
        style,
      ]}
    />
  );
};

/** Placeholder shaped like a list card with a thumbnail. */
export const CardSkeleton: React.FC<{ thumb?: boolean }> = ({ thumb = true }) => (
  <View style={styles.cardSkeleton}>
    {thumb ? <Skeleton width={84} height={84} radius={radii.md} /> : null}
    <View style={{ flex: 1, gap: 10, paddingTop: 2 }}>
      <Skeleton width={64} height={20} radius={10} />
      <Skeleton width="85%" height={16} />
      <Skeleton width="55%" height={12} />
    </View>
  </View>
);

/** Placeholder shaped like a ListItem row. */
export const RowSkeleton: React.FC = () => (
  <View style={styles.rowSkeleton}>
    <Skeleton width={44} height={44} radius={22} />
    <View style={{ flex: 1, gap: 8 }}>
      <Skeleton width="50%" height={14} />
      <Skeleton width="80%" height={12} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  empty: { alignItems: "center", justifyContent: "center", paddingHorizontal: 32, paddingVertical: 48 },
  emptyCompact: { paddingVertical: 28 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  emptyBody: { marginTop: 6, maxWidth: 300 },
  emptyAction: { marginTop: 22, minWidth: 180 },
  notice: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  noticeIcon: { marginTop: 1 },
  noticeAction: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, alignSelf: "flex-start" },
  cardSkeleton: {
    flexDirection: "row",
    gap: 14,
    padding: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: 12,
  },
  rowSkeleton: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14 },
});
