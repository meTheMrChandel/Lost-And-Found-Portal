import * as Haptics from "expo-haptics";

/** Light touch feedback; failures (no vibrator, web) are ignored. */
export const haptics = {
  select: () => {
    Haptics.selectionAsync().catch(() => {});
  },
  tap: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  success: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  error: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  },
};
