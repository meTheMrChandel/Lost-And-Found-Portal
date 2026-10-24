import React from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from "react-native";
import { colors } from "../theme/colors";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  containerStyle?: ViewStyle;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  containerStyle,
  ...props
}) => {
  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          error ? styles.inputError : null,
          props.multiline ? styles.multilineInput : null,
        ]}
        placeholderTextColor={colors.textMuted}
        {...props}
      />
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    height: 48,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 14,
    color: colors.textPrimary,
  },
  multilineInput: {
    height: 90,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  inputError: {
    borderColor: colors.lost,
  },
  errorText: {
    fontSize: 11,
    color: colors.lost,
    marginTop: 4,
    fontWeight: "500",
  },
  helperText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
  },
});
