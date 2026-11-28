import React, { forwardRef, useState } from "react";
import { Pressable, StyleProp, StyleSheet, TextInputProps, View, ViewStyle } from "react-native";
import { colors } from "../theme/colors";
import { radii } from "../theme/tokens";
import { Eye, EyeOff, IconType, Search, X } from "./icons";
import { Text, TextInput, TextInputRef } from "./Text";

export interface TextFieldProps extends TextInputProps {
  label?: string;
  /** Help under the field, replaced by the error when there is one. */
  hint?: string;
  error?: string;
  icon?: IconType;
  /** Marks the label as optional instead of starring required fields. */
  optional?: boolean;
  /** Shows "used/max" under the field; needs maxLength. */
  showCount?: boolean;
  /** Something at the right edge, e.g. a unit or a button. */
  right?: React.ReactNode;
  /** Text before the value, e.g. a currency sign. */
  prefix?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export const TextField = forwardRef<TextInputRef, TextFieldProps>(
  (
    {
      label,
      hint,
      error,
      icon: Icon,
      optional,
      showCount,
      right,
      prefix,
      containerStyle,
      secureTextEntry,
      multiline,
      editable = true,
      onFocus,
      onBlur,
      value,
      maxLength,
      style,
      ...rest
    },
    ref,
  ) => {
    const [focused, setFocused] = useState(false);
    const [revealed, setRevealed] = useState(false);

    const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;

    return (
      <View style={[styles.container, containerStyle]}>
        {label ? (
          <View style={styles.labelRow}>
            <Text variant="subhead">{label}</Text>
            {optional ? (
              <Text variant="caption" color="textMuted">
                Optional
              </Text>
            ) : null}
          </View>
        ) : null}

        <View
          style={[
            styles.field,
            multiline && styles.fieldMultiline,
            { borderColor },
            focused && !error && styles.fieldFocused,
            !editable && styles.fieldDisabled,
          ]}
        >
          {Icon ? (
            <Icon
              size={19}
              color={focused ? colors.primary : colors.textMuted}
              strokeWidth={2}
              style={multiline ? styles.iconTop : undefined}
            />
          ) : null}
          {prefix ? (
            <Text variant="bodyMedium" color="textSecondary">
              {prefix}
            </Text>
          ) : null}
          <TextInput
            ref={ref}
            {...rest}
            value={value}
            maxLength={maxLength}
            editable={editable}
            multiline={multiline}
            secureTextEntry={secureTextEntry && !revealed}
            textAlignVertical={multiline ? "top" : "center"}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            style={[
              styles.input,
              multiline && styles.inputMultiline,
              !editable && { color: colors.textSecondary },
              style,
            ]}
          />
          {secureTextEntry ? (
            <Pressable
              onPress={() => setRevealed((r) => !r)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={revealed ? "Hide password" : "Show password"}
              style={styles.trailing}
            >
              {revealed ? (
                <EyeOff size={19} color={colors.textSecondary} />
              ) : (
                <Eye size={19} color={colors.textSecondary} />
              )}
            </Pressable>
          ) : null}
          {right}
        </View>

        {error || hint || (showCount && maxLength) ? (
          <View style={styles.footer}>
            <Text variant="caption" color={error ? "danger" : "textSecondary"} style={{ flex: 1 }}>
              {error || hint || ""}
            </Text>
            {showCount && maxLength ? (
              <Text variant="caption" color="textMuted">
                {(value || "").length}/{maxLength}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  },
);
TextField.displayName = "TextField";

interface SearchFieldProps extends Omit<TextInputProps, "style"> {
  value: string;
  onChangeText: (text: string) => void;
  style?: StyleProp<ViewStyle>;
}

/** Search box with a clear button. */
export const SearchField: React.FC<SearchFieldProps> = ({ value, onChangeText, style, ...rest }) => {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.search, focused && { borderColor: colors.primary }, style]}>
      <Search size={19} color={focused ? colors.primary : colors.textMuted} strokeWidth={2} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        returnKeyType="search"
        autoCorrect={false}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        style={styles.searchInput}
      />
      {value ? (
        <Pressable
          onPress={() => onChangeText("")}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          style={styles.clear}
        >
          <X size={14} color={colors.textWhite} strokeWidth={3} />
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 18 },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1.5,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    gap: 10,
  },
  fieldMultiline: { alignItems: "flex-start", minHeight: 116, paddingTop: 4 },
  fieldFocused: { backgroundColor: colors.surface },
  fieldDisabled: { backgroundColor: colors.surfaceAlt },
  iconTop: { marginTop: 13 },
  input: { flex: 1, minHeight: 48, paddingVertical: 12, fontSize: 15 },
  inputMultiline: { minHeight: 108, paddingTop: 10, lineHeight: 21 },
  trailing: { paddingLeft: 4, height: 48, justifyContent: "center" },
  footer: { flexDirection: "row", gap: 12, marginTop: 6 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    gap: 10,
  },
  searchInput: { flex: 1, height: 46, fontSize: 15, paddingVertical: 0 },
  clear: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.textMuted,
    alignItems: "center",
    justifyContent: "center",
  },
});
