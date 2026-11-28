import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { colors } from "../theme/colors";
import { radii } from "../theme/tokens";
import { Text, TextInput, TextInputRef } from "./Text";

interface OtpInputProps {
  value: string;
  onChange: (code: string) => void;
  length?: number;
  /** Called once all digits are in. */
  onComplete?: (code: string) => void;
  error?: boolean;
  autoFocus?: boolean;
}

/** One box per digit over a single hidden field, so paste and SMS autofill still work. */
export const OtpInput: React.FC<OtpInputProps> = ({ value, onChange, length = 6, onComplete, error, autoFocus }) => {
  const input = useRef<TextInputRef>(null);
  const [focused, setFocused] = useState(false);

  return (
    <Pressable onPress={() => input.current?.focus()} accessibilityLabel="Verification code" style={styles.row}>
      {Array.from({ length }).map((_, i) => {
        const digit = value[i] || "";
        const active = focused && (i === value.length || (i === length - 1 && value.length === length));
        return (
          <View
            key={i}
            style={[
              styles.box,
              digit ? styles.boxFilled : null,
              active ? styles.boxActive : null,
              error ? styles.boxError : null,
            ]}
          >
            <Text style={styles.digit}>{digit}</Text>
          </View>
        );
      })}
      <TextInput
        ref={input}
        value={value}
        onChangeText={(text) => {
          const code = text.replace(/\D/g, "").slice(0, length);
          onChange(code);
          if (code.length === length) onComplete?.(code);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        autoFocus={autoFocus}
        caretHidden
        style={styles.hidden}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  box: {
    flex: 1,
    maxWidth: 52,
    height: 58,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  boxFilled: { borderColor: colors.borderStrong },
  boxActive: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  boxError: { borderColor: colors.danger },
  digit: { fontSize: 24, lineHeight: 30, fontWeight: "600" },
  // Kept on screen (not display: none) so the keyboard and autofill can attach to it
  hidden: { position: "absolute", width: 1, height: 1, opacity: 0 },
});
