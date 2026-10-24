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
import { useAuth } from "../../context/AuthContext";
import { Input } from "../../components/Input";
import { Button } from "../../components/Button";
import { colors } from "../../theme/colors";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Please enter your IIT Ropar email and password.");
      return;
    }

    if (!email.toLowerCase().endsWith("@iitrpr.ac.in")) {
      setError("Only valid @iitrpr.ac.in emails are accepted.");
      return;
    }

    setError("");
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      navigation.navigate("Main" as any);
    } catch (err: any) {
      setError(err.formattedMessage || err.message || "Failed to sign in. Please verify your credentials.");
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
        {/* Brand Logo & Header */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>LF</Text>
          </View>
          <Text style={styles.title}>IIT Ropar</Text>
          <Text style={styles.subtitle}>LOST & FOUND PORTAL</Text>
        </View>

        {/* Card Form */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Student & Staff Login</Text>
          <Text style={styles.cardSubtitle}>
            Sign in with your institute email to track belongings and claims.
          </Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          ) : null}

          <Input
            label="Institute Email"
            placeholder="e.g. 2026aim1023@iitrpr.ac.in"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setError("");
            }}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Input
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setError("");
            }}
            secureTextEntry
          />

          <TouchableOpacity
            onPress={() => navigation.navigate("ForgotPassword")}
            style={styles.forgotBtn}
          >
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          <Button
            title="Sign In"
            onPress={handleLogin}
            loading={loading}
            style={styles.submitBtn}
          />

          {/* Quick Demo Fill Helper */}
          <TouchableOpacity
            style={styles.demoHelper}
            onPress={() => {
              setEmail("2026aim1023@iitrpr.ac.in");
              setError("");
            }}
          >
            <Text style={styles.demoHelperText}>
              💡 Fill Demo Email (2026aim1023@iitrpr.ac.in)
            </Text>
          </TouchableOpacity>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>New to IIT Ropar Lost & Found? </Text>
            <TouchableOpacity onPress={() => navigation.navigate("Register")}>
              <Text style={styles.registerLink}>Register</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.guestDivider}>
            <View style={styles.line} />
            <Text style={styles.orText}>OR</Text>
            <View style={styles.line} />
          </View>

          <TouchableOpacity
            style={styles.guestBtn}
            onPress={() => navigation.navigate("Main" as any)}
          >
            <Text style={styles.guestBtnText}>← Continue as Guest (Browse Feed)</Text>
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
    marginBottom: 24,
  },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 12,
  },
  logoText: {
    color: colors.textWhite,
    fontSize: 24,
    fontWeight: "bold",
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.ocean,
    letterSpacing: 1.5,
    marginTop: 2,
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
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  cardSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 18,
    lineHeight: 18,
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
  forgotBtn: {
    alignSelf: "flex-end",
    marginBottom: 16,
    marginTop: -4,
  },
  forgotText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.ocean,
  },
  submitBtn: {
    marginTop: 4,
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
  registerLink: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },
  demoHelper: {
    backgroundColor: colors.primaryLight,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 10,
    alignItems: "center",
  },
  demoHelperText: {
    fontSize: 11,
    color: colors.primaryHover,
    fontWeight: "600",
  },
  guestDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 14,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderLight,
  },
  orText: {
    marginHorizontal: 10,
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
  },
  guestBtn: {
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  guestBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
});
