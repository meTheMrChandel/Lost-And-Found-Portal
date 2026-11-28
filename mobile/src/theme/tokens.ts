import { Platform, TextStyle, ViewStyle } from "react-native";
import { colors } from "./colors";

/** Inter, the website's typeface, loaded in App.tsx. One family per weight. */
export const fonts = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
} as const;

/** The Inter face for a fontWeight, since Android can't synthesise weights of a custom font. */
export function fontForWeight(weight?: TextStyle["fontWeight"] | number | null): string {
  switch (String(weight ?? "400")) {
    case "500":
      return fonts.medium;
    case "600":
      return fonts.semibold;
    case "700":
    case "800":
    case "900":
    case "bold":
      return fonts.bold;
    default:
      return fonts.regular;
  }
}

const base: TextStyle = Platform.select({ android: { includeFontPadding: false }, default: {} });

export const typography = {
  display: { ...base, fontFamily: fonts.bold, fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  title1: { ...base, fontFamily: fonts.bold, fontSize: 26, lineHeight: 32, letterSpacing: -0.5 },
  title2: { ...base, fontFamily: fonts.bold, fontSize: 21, lineHeight: 27, letterSpacing: -0.3 },
  title3: { ...base, fontFamily: fonts.semibold, fontSize: 17, lineHeight: 23, letterSpacing: -0.2 },
  headline: { ...base, fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21, letterSpacing: -0.1 },
  body: { ...base, fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyMedium: { ...base, fontFamily: fonts.medium, fontSize: 15, lineHeight: 22 },
  callout: { ...base, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  calloutMedium: { ...base, fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 },
  subhead: { ...base, fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  footnote: { ...base, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  caption: { ...base, fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  micro: { ...base, fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14 },
  overline: {
    ...base,
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  button: { ...base, fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, letterSpacing: 0.1 },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

/** 4-point spacing scale. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

/** Horizontal padding of every screen. */
export const SCREEN_PADDING = 20;

export const radii = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const shadows = {
  none: {} as ViewStyle,
  card: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  } as ViewStyle,
  raised: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  } as ViewStyle,
  floating: {
    shadowColor: colors.primaryPressed,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 10,
  } as ViewStyle,
};

export const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 };
