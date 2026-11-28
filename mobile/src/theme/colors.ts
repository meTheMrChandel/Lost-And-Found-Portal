/**
 * Colour tokens, shared with the website's palette (frontend/src/app/globals.css):
 * emerald brand, warm cream background, charcoal text, coral for lost and amber for pending.
 */
export const colors = {
  // Brand
  primary: "#047857",
  primaryPressed: "#065F46",
  primaryTint: "#ECFDF5",
  primarySoft: "#D1FAE5",
  accent: "#10B981",

  // Status
  lost: "#D94F3B",
  lostPressed: "#B93C2A",
  lostTint: "#FEF1EE",
  lostSoft: "#FBD9D2",
  found: "#047857",
  foundTint: "#ECFDF5",
  warning: "#B45309",
  warningTint: "#FFF7E6",
  warningSoft: "#FDE7B8",
  info: "#0369A1",
  infoTint: "#EFF8FF",
  infoSoft: "#D3ECFB",
  danger: "#D94F3B",
  dangerTint: "#FEF1EE",
  reward: "#B7791F",
  rewardTint: "#FFF6E0",

  // Surfaces
  background: "#FAF7F2",
  surface: "#FFFFFF",
  surfaceAlt: "#F4F0E8",
  surfacePressed: "#F1ECE3",
  border: "#E6E0D5",
  borderStrong: "#D5CDBE",
  divider: "#EEE9E0",
  overlay: "rgba(17, 17, 19, 0.45)",
  scrim: "rgba(17, 17, 19, 0.55)",

  // Text
  textPrimary: "#1C1C1E",
  textSecondary: "#5C6170",
  textMuted: "#8E929B",
  textWhite: "#FFFFFF",
  textOnPrimary: "#FFFFFF",

  charcoal: "#1C1C1E",
  cream: "#FAF7F2",
  amber: "#F5B73B",
  shadow: "#1C1C1E",

  // Older names still used by a few screens
  primaryHover: "#065F46",
  primaryLight: "#ECFDF5",
  ocean: "#0369A1",
  oceanTeal: "#0D9488",
  oceanLight: "#EFF8FF",
  lostLight: "#FEF1EE",
  foundLight: "#ECFDF5",
  warningLight: "#FFF7E6",
  card: "#FFFFFF",
  cardBorder: "#E6E0D5",
  cardSubtle: "#F4F0E8",
  borderLight: "#EEE9E0",
};

export type ColorName = keyof typeof colors;
