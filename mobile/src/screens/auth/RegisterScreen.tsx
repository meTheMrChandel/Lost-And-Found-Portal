import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AuthStackParamList } from "../../navigation/types";
import { authApi, DEPARTMENTS, PROGRAM_YEARS } from "../../api/auth";
import { errorMessage } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Button, haptics, Notice, OtpInput, SelectField, Text, TextField, useToast, TextInputRef } from "../../ui";
import { BedDouble, Building2, GraduationCap, Hash, Lock, Mail, Phone, UserRound } from "../../ui/icons";
import { AuthLayout } from "./AuthLayout";

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

const INSTITUTE_DOMAIN = "@iitrpr.ac.in";
const RESEND_SECONDS = 30;

/** Counts down to zero once a second; restart() starts it again. */
function useCountdown(seconds: number) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);
  return { left, restart: () => setLeft(seconds) };
}

export const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const { login } = useAuth();
  const toast = useToast();
  const resend = useCountdown(RESEND_SECONDS);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [regNo, setRegNo] = useState("");
  const [department, setDepartment] = useState<string | null>(null);
  const [programYear, setProgramYear] = useState<string | null>(null);
  const [hostel, setHostel] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const regRef = useRef<TextInputRef>(null);
  const confirmRef = useRef<TextInputRef>(null);

  const address = email.trim().toLowerCase();

  const sendCode = async () => {
    if (!address.endsWith(INSTITUTE_DOMAIN) || address.length <= INSTITUTE_DOMAIN.length) {
      setError(`Use your institute email, ending in ${INSTITUTE_DOMAIN}.`);
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await authApi.requestOtp(address, "registration");
      // Development servers return the code so it can be tested without email
      if (__DEV__ && res?.debug_otp) setCode(String(res.debug_otp));
      resend.restart();
      setStep(2);
    } catch (err: any) {
      setError(errorMessage(err, "Couldn't send the code. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (value = code) => {
    if (value.length !== 6) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await authApi.verifyOtp(address, value, "registration");
      haptics.success();
      setStep(3);
    } catch (err: any) {
      setError(errorMessage(err, "That code didn't work. Check it or send a new one."));
    } finally {
      setLoading(false);
    }
  };

  const createAccount = async () => {
    const errors: Record<string, string> = {};
    if (!fullName.trim()) errors.fullName = "Enter your full name.";
    if (!regNo.trim()) errors.regNo = "Enter your registration number.";
    if (!department) errors.department = "Choose your department.";
    if (!programYear) errors.programYear = "Choose your programme and year.";
    if (password.length < 8) errors.password = "Use at least 8 characters.";
    else if (/^\d+$/.test(password)) errors.password = "Use letters as well as numbers.";
    if (confirm !== password) errors.confirm = "The passwords don't match.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setError("");
      return;
    }

    setError("");
    setLoading(true);
    try {
      await authApi.register({
        email: address,
        password,
        full_name: fullName.trim(),
        registration_number: regNo.trim().toUpperCase(),
        department: department!,
        program_year: programYear!,
        ...(hostel.trim() ? { hostel: hostel.trim() } : {}),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      });
    } catch (err: any) {
      setError(errorMessage(err, "Couldn't create your account."));
      setLoading(false);
      return;
    }

    // Sign straight in with the new account
    try {
      await login(address, password);
      haptics.success();
      toast.show(`Welcome, ${fullName.trim().split(" ")[0]}! Your account is ready.`);
      const root = navigation.getParent();
      if (root?.canGoBack()) root.goBack();
      else root?.navigate("Main");
    } catch {
      toast.show("Account created. Please sign in.");
      navigation.navigate("Login", { email: address });
    }
  };

  const back = () => {
    setError("");
    if (step === 1) navigation.goBack();
    else setStep((s) => (s - 1) as 1 | 2);
  };

  if (step === 1) {
    return (
      <AuthLayout
        leading="back"
        onBack={back}
        step={[1, 3]}
        title="Create your account"
        subtitle="Lost & Found is for the IIT Ropar campus. We'll email a code to confirm your institute address."
      >
        {error ? <Notice tone="danger" message={error} style={styles.notice} /> : null}
        <TextField
          label="Institute email"
          icon={Mail}
          placeholder={`you${INSTITUTE_DOMAIN}`}
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
        <Button title="Send code" onPress={sendCode} loading={loading} size="lg" fullWidth />
        <View style={styles.switchRow}>
          <Text variant="callout" color="textSecondary">
            Already have an account?
          </Text>
          <Pressable onPress={() => navigation.navigate("Login")} hitSlop={10}>
            <Text variant="callout" color="primary" style={{ fontWeight: "600" }}>
              Sign in
            </Text>
          </Pressable>
        </View>
      </AuthLayout>
    );
  }

  if (step === 2) {
    return (
      <AuthLayout
        leading="back"
        onBack={back}
        step={[2, 3]}
        title="Check your email"
        subtitle={`Enter the 6-digit code we sent to ${address}. It may take a minute to arrive.`}
      >
        {error ? <Notice tone="danger" message={error} style={styles.notice} /> : null}
        <OtpInput
          value={code}
          onChange={(c) => {
            setCode(c);
            setError("");
          }}
          onComplete={(c) => verifyCode(c)}
          error={!!error}
          autoFocus
        />
        <Button
          title="Verify"
          onPress={() => verifyCode()}
          loading={loading}
          size="lg"
          fullWidth
          style={{ marginTop: 28 }}
        />
        <View style={styles.switchRow}>
          <Text variant="callout" color="textSecondary">
            Didn't get it?
          </Text>
          {resend.left > 0 ? (
            <Text variant="callout" color="textMuted">
              Send again in {resend.left}s
            </Text>
          ) : (
            <Pressable onPress={sendCode} hitSlop={10} disabled={loading}>
              <Text variant="callout" color="primary" style={{ fontWeight: "600" }}>
                Send a new code
              </Text>
            </Pressable>
          )}
        </View>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      leading="back"
      onBack={back}
      step={[3, 3]}
      title="About you"
      subtitle="Admins use these details to verify claims. Your phone number is never shown publicly."
      footer={<Button title="Create account" onPress={createAccount} loading={loading} size="lg" fullWidth />}
    >
      {error ? <Notice tone="danger" message={error} style={styles.notice} /> : null}
      <TextField
        label="Full name"
        icon={UserRound}
        placeholder="As on your ID card"
        value={fullName}
        onChangeText={setFullName}
        error={fieldErrors.fullName}
        autoCapitalize="words"
        autoComplete="name"
        returnKeyType="next"
        onSubmitEditing={() => regRef.current?.focus()}
        submitBehavior="submit"
      />
      <TextField
        ref={regRef}
        label="Registration number"
        icon={Hash}
        placeholder="e.g. 2024CSB1001"
        value={regNo}
        onChangeText={(t) => setRegNo(t.toUpperCase())}
        error={fieldErrors.regNo}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      <SelectField
        label="Department"
        placeholder="Choose your department"
        icon={Building2}
        value={department}
        options={DEPARTMENTS}
        onChange={setDepartment}
        error={fieldErrors.department}
      />
      <SelectField
        label="Programme and year"
        placeholder="Choose your programme"
        icon={GraduationCap}
        value={programYear}
        options={PROGRAM_YEARS}
        onChange={setProgramYear}
        error={fieldErrors.programYear}
      />
      <TextField
        label="Hostel"
        optional
        icon={BedDouble}
        placeholder="e.g. Brahmaputra"
        value={hostel}
        onChangeText={setHostel}
      />
      <TextField
        label="Phone"
        optional
        icon={Phone}
        placeholder="10-digit mobile number"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        maxLength={15}
        hint="Only the admin office can see it."
      />
      <TextField
        label="Password"
        icon={Lock}
        placeholder="At least 8 characters"
        value={password}
        onChangeText={setPassword}
        error={fieldErrors.password}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        submitBehavior="submit"
      />
      <TextField
        ref={confirmRef}
        label="Confirm password"
        icon={Lock}
        placeholder="Type it again"
        value={confirm}
        onChangeText={setConfirm}
        error={fieldErrors.confirm}
        secureTextEntry
        autoComplete="new-password"
        returnKeyType="done"
        onSubmitEditing={createAccount}
      />
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  notice: { marginBottom: 18 },
  switchRow: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 24 },
});
