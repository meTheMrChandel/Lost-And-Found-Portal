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

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

export const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form states
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [regNo, setRegNo] = useState("");
  const [password, setPassword] = useState("");
  const [department, setDepartment] = useState("CSE");
  const [programYear, setProgramYear] = useState("BTECH_1");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  // Step 1: Send OTP
  const handleRequestOtp = async () => {
    if (!email.trim()) {
      setError("Please enter your IIT Ropar email.");
      return;
    }
    if (!email.toLowerCase().endsWith("@iitrpr.ac.in")) {
      setError("Only valid @iitrpr.ac.in emails are accepted.");
      return;
    }

    setError("");
    setLoading(true);
    try {
      await authApi.requestOtp(email.trim().toLowerCase(), "registration");
      setInfoMsg(`A 6-digit OTP code has been sent to ${email}`);
      setStep(2);
    } catch (err: any) {
      setError(err.formattedMessage || err.message || "Failed to send verification code.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      setError("Please enter a valid 6-digit OTP code.");
      return;
    }

    setError("");
    setLoading(true);
    try {
      await authApi.verifyOtp(email.trim().toLowerCase(), otpCode.trim(), "registration");
      setInfoMsg("OTP verified! Now complete your student profile.");
      setStep(3);
    } catch (err: any) {
      setError(err.formattedMessage || err.message || "Invalid or expired OTP code.");
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Complete Registration
  const handleCompleteRegistration = async () => {
    if (!fullName.trim() || !regNo.trim() || !password.trim()) {
      setError("Please fill in all required fields.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setError("");
    setLoading(true);
    try {
      await authApi.register({
        email: email.trim().toLowerCase(),
        password,
        full_name: fullName.trim(),
        registration_number: regNo.trim().toUpperCase(),
        department,
        program_year: programYear,
      });

      Alert.alert(
        "Registration Successful",
        "Your student account has been created. Please sign in.",
        [{ text: "Sign In", onPress: () => navigation.navigate("Login") }]
      );
    } catch (err: any) {
      setError(err.formattedMessage || err.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Student Registration</Text>
          <Text style={styles.subtitle}>
            Step {step} of 3 •{" "}
            {step === 1 ? "Email Verification" : step === 2 ? "Enter OTP" : "Student Details"}
          </Text>

          {/* Stepper Progress Bar */}
          <View style={styles.stepperRow}>
            <View style={[styles.stepDot, step >= 1 && styles.stepActive]} />
            <View style={[styles.stepDot, step >= 2 && styles.stepActive]} />
            <View style={[styles.stepDot, step >= 3 && styles.stepActive]} />
          </View>
        </View>

        <View style={styles.card}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          ) : null}

          {infoMsg ? (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>✓ {infoMsg}</Text>
            </View>
          ) : null}

          {/* STEP 1: Email */}
          {step === 1 && (
            <>
              <Input
                label="IIT Ropar Email Address"
                placeholder="e.g. 2026aim1023@iitrpr.ac.in"
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  setError("");
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                helperText="Only verified @iitrpr.ac.in addresses are accepted."
              />
              <Button
                title="Send Verification Code"
                onPress={handleRequestOtp}
                loading={loading}
                style={styles.btn}
              />
            </>
          )}

          {/* STEP 2: OTP */}
          {step === 2 && (
            <>
              <Input
                label="6-Digit Verification Code"
                placeholder="Enter 6-digit code"
                value={otpCode}
                onChangeText={(t) => {
                  setOtpCode(t);
                  setError("");
                }}
                keyboardType="number-pad"
                maxLength={6}
                style={styles.otpInput}
              />
              <Button
                title="Verify OTP Code"
                onPress={handleVerifyOtp}
                loading={loading}
                style={styles.btn}
              />
              <TouchableOpacity onPress={() => setStep(1)} style={styles.changeEmailBtn}>
                <Text style={styles.changeEmailText}>← Change Email</Text>
              </TouchableOpacity>
            </>
          )}

          {/* STEP 3: Profile Details */}
          {step === 3 && (
            <>
              <Input
                label="Full Name"
                placeholder="e.g. Vishal Chandel"
                value={fullName}
                onChangeText={setFullName}
              />
              <Input
                label="Registration Number"
                placeholder="e.g. 2026AIM1023"
                value={regNo}
                onChangeText={setRegNo}
                autoCapitalize="characters"
              />
              <Input
                label="Password"
                placeholder="Min. 8 characters"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              <Button
                title="Complete Registration"
                onPress={handleCompleteRegistration}
                loading={loading}
                style={styles.btn}
              />
            </>
          )}

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already registered? </Text>
            <TouchableOpacity onPress={() => navigation.navigate("Login")}>
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
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
    marginTop: 4,
  },
  stepperRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  stepDot: {
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  stepActive: {
    backgroundColor: colors.primary,
    width: 36,
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
  infoBox: {
    backgroundColor: colors.foundLight,
    borderColor: "#A7F3D0",
    borderWidth: 1,
    padding: 10,
    borderRadius: 12,
    marginBottom: 14,
  },
  infoText: {
    color: colors.found,
    fontSize: 12,
    fontWeight: "600",
  },
  otpInput: {
    textAlign: "center",
    letterSpacing: 8,
    fontSize: 20,
    fontWeight: "bold",
  },
  btn: {
    marginTop: 8,
  },
  changeEmailBtn: {
    alignSelf: "center",
    marginTop: 12,
  },
  changeEmailText: {
    fontSize: 12,
    color: colors.ocean,
    fontWeight: "600",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 18,
  },
  footerText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  loginLink: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },
});
