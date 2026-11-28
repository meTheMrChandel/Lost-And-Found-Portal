import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AuthStackParamList } from "../../navigation/types";
import { authApi } from "../../api/auth";
import { errorMessage } from "../../api/client";
import { Button, haptics, Notice, OtpInput, Text, TextField, useToast, TextInputRef } from "../../ui";
import { Lock, Mail } from "../../ui/icons";
import { AuthLayout } from "./AuthLayout";

type Props = NativeStackScreenProps<AuthStackParamList, "ForgotPassword">;

const RESEND_SECONDS = 30;

export const ForgotPasswordScreen: React.FC<Props> = ({ navigation, route }) => {
  const toast = useToast();
  const confirmRef = useRef<TextInputRef>(null);

  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState(route.params?.email || "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const address = email.trim().toLowerCase();

  const sendCode = async () => {
    if (!address.endsWith("@iitrpr.ac.in")) {
      setError("Enter the institute email you registered with.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await authApi.requestOtp(address, "password_reset");
      if (__DEV__ && res?.debug_otp) setCode(String(res.debug_otp));
      setResendIn(RESEND_SECONDS);
      setStep(2);
    } catch (err: any) {
      setError(errorMessage(err, "Couldn't send a reset code. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (code.length !== 6) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    if (password.length < 8) {
      setError("Your new password needs at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The passwords don't match.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await authApi.resetPassword({ email: address, code, new_password: password });
      haptics.success();
      toast.show("Password updated. Sign in with your new password.");
      navigation.navigate("Login", { email: address });
    } catch (err: any) {
      setError(errorMessage(err, "Couldn't reset your password."));
      setLoading(false);
    }
  };

  if (step === 1) {
    return (
      <AuthLayout
        leading="back"
        title="Reset your password"
        subtitle="Enter your institute email and we'll send you a code to set a new password."
      >
        {error ? <Notice tone="danger" message={error} style={styles.notice} /> : null}
        <TextField
          label="Institute email"
          icon={Mail}
          placeholder="you@iitrpr.ac.in"
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            setError("");
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          returnKeyType="send"
          onSubmitEditing={sendCode}
        />
        <Button title="Send reset code" onPress={sendCode} loading={loading} size="lg" fullWidth />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      leading="back"
      onBack={() => {
        setError("");
        setStep(1);
      }}
      title="Choose a new password"
      subtitle={`Enter the code we sent to ${address}, then your new password.`}
      footer={<Button title="Update password" onPress={resetPassword} loading={loading} size="lg" fullWidth />}
    >
      {error ? <Notice tone="danger" message={error} style={styles.notice} /> : null}
      <Text variant="subhead" style={{ marginBottom: 8 }}>
        Verification code
      </Text>
      <OtpInput value={code} onChange={setCode} autoFocus />
      <View style={styles.resendRow}>
        {resendIn > 0 ? (
          <Text variant="footnote" color="textMuted">
            Send a new code in {resendIn}s
          </Text>
        ) : (
          <Pressable onPress={sendCode} hitSlop={10} disabled={loading}>
            <Text variant="footnote" color="primary" style={{ fontWeight: "600" }}>
              Send a new code
            </Text>
          </Pressable>
        )}
      </View>
      <TextField
        label="New password"
        icon={Lock}
        placeholder="At least 8 characters"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        submitBehavior="submit"
      />
      <TextField
        ref={confirmRef}
        label="Confirm new password"
        icon={Lock}
        placeholder="Type it again"
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        autoComplete="new-password"
        returnKeyType="done"
        onSubmitEditing={resetPassword}
      />
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  notice: { marginBottom: 18 },
  resendRow: { alignItems: "flex-end", marginTop: 10, marginBottom: 22 },
});
