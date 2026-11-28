import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AuthStackParamList } from "../../navigation/types";
import { useAuth } from "../../context/AuthContext";
import { errorMessage } from "../../api/client";
import { Button, haptics, Notice, Text, TextField, useToast, TextInputRef } from "../../ui";
import { Lock, Mail } from "../../ui/icons";
import { colors } from "../../theme/colors";
import { AuthLayout } from "./AuthLayout";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export const LoginScreen: React.FC<Props> = ({ navigation, route }) => {
  const { login } = useAuth();
  const toast = useToast();
  const passwordRef = useRef<TextInputRef>(null);

  const [email, setEmail] = useState(route.params?.email || "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const closeAuth = () => {
    const root = navigation.getParent();
    if (root?.canGoBack()) root.goBack();
    else root?.navigate("Main");
  };

  const handleLogin = async () => {
    const address = email.trim().toLowerCase();
    if (!address || !password) {
      setError("Enter your email and password.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(address)) {
      setError("That doesn't look like an email address.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const profile = await login(address, password);
      haptics.success();
      toast.show(`Welcome back${profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}`);
      closeAuth();
    } catch (err: any) {
      setError(errorMessage(err, "Couldn't sign you in. Check your email and password."));
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      showLogo
      title="Welcome back"
      subtitle="Sign in with your IIT Ropar email to report items, message the admin office and track your reports."
    >
      {error ? <Notice tone="danger" message={error} style={styles.notice} /> : null}

      <TextField
        label="Institute email"
        icon={Mail}
        placeholder="you@iitrpr.ac.in"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          setError("");
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        submitBehavior="submit"
      />
      <TextField
        ref={passwordRef}
        label="Password"
        icon={Lock}
        placeholder="Your password"
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          setError("");
        }}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={handleLogin}
        containerStyle={{ marginBottom: 10 }}
      />
      <Pressable
        onPress={() => navigation.navigate("ForgotPassword", { email: email.trim() || undefined })}
        hitSlop={10}
        style={styles.forgot}
        accessibilityRole="link"
      >
        <Text variant="subhead" color="primary">
          Forgot password?
        </Text>
      </Pressable>

      <Button title="Sign in" onPress={handleLogin} loading={loading} size="lg" fullWidth />

      {/* Quick demo sign-in for development builds only, so no credentials ship in the APK */}
      {__DEV__ ? (
        <View style={styles.devRow}>
          <Button
            title="Demo student"
            size="sm"
            variant="tonal"
            onPress={() => {
              setEmail("2026aim1023@iitrpr.ac.in");
              setPassword("Student@123456");
            }}
          />
          <Button
            title="Demo admin"
            size="sm"
            variant="tonal"
            onPress={() => {
              setEmail("admin@iitrpr.ac.in");
              setPassword("Admin@123456");
            }}
          />
        </View>
      ) : null}

      <View style={styles.divider}>
        <View style={styles.line} />
        <Text variant="caption" color="textMuted">
          New to Lost & Found?
        </Text>
        <View style={styles.line} />
      </View>
      <Button
        title="Create an account"
        variant="secondary"
        size="lg"
        fullWidth
        onPress={() => navigation.navigate("Register")}
      />
      <Pressable onPress={closeAuth} hitSlop={10} style={styles.guest} accessibilityRole="button">
        <Text variant="subhead" color="textSecondary">
          Browse without signing in
        </Text>
      </Pressable>
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  notice: { marginBottom: 18 },
  forgot: { alignSelf: "flex-end", marginBottom: 24 },
  devRow: { flexDirection: "row", gap: 8, marginTop: 12, justifyContent: "center" },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 24 },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.borderStrong },
  guest: { alignSelf: "center", marginTop: 20, padding: 6 },
});
