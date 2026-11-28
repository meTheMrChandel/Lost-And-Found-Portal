import React, { createContext, forwardRef, useContext } from "react";
import {
  Platform,
  Text as RNText,
  TextInput as RNTextInput,
  TextInputProps,
  TextProps as RNTextProps,
  StyleSheet,
  TextStyle,
} from "react-native";
import { colors, ColorName } from "../theme/colors";
import { fontForWeight, fonts, TypographyVariant, typography } from "../theme/tokens";

/** True inside another Text, where colour and size are inherited instead of defaulted. */
const NestedText = createContext(false);

/** Text without a variant: body size in Inter, leaving the line height to the font. */
const DEFAULT_TEXT: TextStyle = {
  fontFamily: fonts.regular,
  fontSize: 15,
  ...(Platform.OS === "android" ? { includeFontPadding: false } : {}),
};

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  /** A theme colour name or any colour string. */
  color?: ColorName | (string & {});
  align?: TextStyle["textAlign"];
}

function resolveColor(color?: string): string | undefined {
  if (!color) return undefined;
  return (colors as Record<string, string>)[color] ?? color;
}

export type TextRef = React.ComponentRef<typeof RNText>;
export type TextInputRef = React.ComponentRef<typeof RNTextInput>;

/**
 * Text in Inter. A `fontWeight` in the style picks the matching Inter face, so styles
 * written for the system font keep their weight.
 */
export const Text = forwardRef<TextRef, TextProps>(({ variant, color, align, style, children, ...rest }, ref) => {
  const nested = useContext(NestedText);
  const flat = (StyleSheet.flatten(style) || {}) as TextStyle;
  const { fontWeight, ...own } = flat;

  const variantStyle = variant ? typography[variant] : nested ? undefined : DEFAULT_TEXT;
  const family = own.fontFamily ?? (fontWeight != null ? fontForWeight(fontWeight) : variantStyle?.fontFamily);
  const defaultColor = !nested && own.color == null ? colors.textPrimary : undefined;
  // A custom size without a line height would otherwise keep the variant's, and clip or gape
  const lineHeight =
    own.fontSize != null && own.lineHeight == null && variantStyle?.lineHeight != null
      ? Math.round(own.fontSize * 1.35)
      : undefined;

  return (
    <RNText
      ref={ref}
      {...rest}
      style={[
        variantStyle,
        defaultColor ? { color: defaultColor } : null,
        own,
        lineHeight ? { lineHeight } : null,
        color ? { color: resolveColor(color) } : null,
        align ? { textAlign: align } : null,
        family ? { fontFamily: family } : null,
      ]}
    >
      <NestedText.Provider value={true}>{children}</NestedText.Provider>
    </RNText>
  );
});
Text.displayName = "Text";

/** TextInput in Inter with the theme's text and placeholder colours. */
export const TextInput = forwardRef<TextInputRef, TextInputProps>(({ style, placeholderTextColor, ...rest }, ref) => {
  const flat = (StyleSheet.flatten(style) || {}) as TextStyle;
  const { fontWeight, ...own } = flat;
  return (
    <RNTextInput
      ref={ref}
      placeholderTextColor={placeholderTextColor ?? colors.textMuted}
      selectionColor={colors.primary}
      cursorColor={colors.primary}
      {...rest}
      style={[
        { fontFamily: fonts.regular, fontSize: 15, color: colors.textPrimary },
        own,
        { fontFamily: own.fontFamily ?? fontForWeight(fontWeight) },
      ]}
    />
  );
});
TextInput.displayName = "TextInput";
