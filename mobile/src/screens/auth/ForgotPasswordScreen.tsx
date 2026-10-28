import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AuthStackParamList } from "../../navigation/types";
import { authApi } from "../../api/auth";
import { Input } from "../../components/Input";
import { Button } from "../../components/Button";
import { colors } from "../../theme/colors";

type Props = NativeStackScreenProps<AuthStackParamList, "ForgotPassword">;

export const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRequestOtp = async () => {
    if (!email.trim() || !email.toLowerCase().endsWith("@iitrpr.ac.in")) {
      setError("Please enter a valid @iitrpr.ac.in address.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await authApi.requestOtp(email.trim().toLowerCase(), "password_reset");
      if (res && res.debug_otp) {
        setOtpCode(res.debug_otp);
      }
      setStep(2);
    } catch (err: any) {
      setError(err.formattedMessage || err.message || "Failed to send reset code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (otpCode.length !== 6 || newPassword.length < 8) {
      setError("Please provide the 6-digit OTP and min. 8 character password.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await authApi.resetPassword({
        email: email.trim().toLowerCase(),
        otp_code: otpCode.trim(),
        new_password: newPassword,
      });

      Alert.alert(
        "Password Reset Successful",
        "Your password has been updated. Please sign in with your new password.",
        [{ text: "Sign In", onPress: () => navigation.navigate("Login") }]
      );
    } catch (err: any) {
      setError(err.formattedMessage || err.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            {step === 1
              ? "Enter your email to receive a password reset code."
              : `Enter the code sent to ${email} and set your new password.`}
          </Text>
        </View>

        <View style={styles.card}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          ) : null}

          {step === 1 ? (
            <>
              <Input
                label="IIT Ropar Email"
                placeholder="e.g. 2026aim1023@iitrpr.ac.in"
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  setError("");
                }}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Button
                title="Send Reset Code"
                onPress={handleRequestOtp}
                loading={loading}
              />
              <TouchableOpacity
                style={{ marginTop: 10, padding: 8, backgroundColor: colors.ocean + "12", borderRadius: 8, alignItems: "center" }}
                onPress={() => {
                  setEmail("2026aim1023@iitrpr.ac.in");
                  setError("");
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: colors.ocean }}>
                  💡 Fill Demo Email (2026aim1023@iitrpr.ac.in)
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Input
                label="6-Digit Verification Code"
                placeholder="Enter 6-digit OTP"
                value={otpCode}
                onChangeText={setOtpCode}
                keyboardType="number-pad"
                maxLength={6}
              />
              <Input
                label="New Password"
                placeholder="Min. 8 characters"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />
              <Button
                title="Update Password"
                onPress={handleResetPassword}
                loading={loading}
              />
            </>
          )}

          <TouchableOpacity
            onPress={() => navigation.navigate("Login")}
            style={styles.backBtn}
          >
            <Text style={styles.backText}>← Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 24,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  errorBox: {
    backgroundColor: colors.lostLight,
    borderColor: "#FECACA",
    borderWidth: 1,
    padding: 10,
    borderRadius: 12,
    marginBottom: 14,
  },
  errorText: {
    color: colors.lost,
    fontSize: 12,
    fontWeight: "500",
  },
  backBtn: {
    alignSelf: "center",
    marginTop: 18,
  },
  backText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: "600",
  },
});
