import React from "react";
import { StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { IconButton, Logo, Screen, Text } from "../../ui";
import { ArrowLeft, X } from "../../ui/icons";
import { colors } from "../../theme/colors";

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  /** "close" leaves sign-in altogether; "back" goes to the previous auth step. */
  leading?: "close" | "back";
  onBack?: () => void;
  /** Progress through a multi-step flow, e.g. [2, 3]. */
  step?: [number, number];
  showLogo?: boolean;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/** Shared frame for the sign-in, registration and password reset screens. */
export const AuthLayout: React.FC<AuthLayoutProps> = ({
  title,
  subtitle,
  leading = "close",
  onBack,
  step,
  showLogo,
  footer,
  children,
}) => {
  const navigation = useNavigation();

  const leave = () => {
    if (onBack) return onBack();
    if (leading === "back" && navigation.canGoBack()) return navigation.goBack();
    // Close the whole sign-in flow and return to where the user came from
    const root = navigation.getParent();
    if (root?.canGoBack()) root.goBack();
    else root?.navigate("Main" as never);
  };

  return (
    <Screen scroll safeTop footer={footer} contentStyle={styles.content}>
      <View style={styles.topBar}>
        <IconButton
          icon={leading === "back" ? ArrowLeft : X}
          onPress={leave}
          variant="surface"
          accessibilityLabel={leading === "back" ? "Back" : "Close"}
        />
        {step ? (
          <View style={styles.steps}>
            {Array.from({ length: step[1] }).map((_, i) => (
              <View key={i} style={[styles.stepBar, i < step[0] && styles.stepBarDone]} />
            ))}
          </View>
        ) : null}
      </View>

      {showLogo ? <Logo size={60} /> : null}
      <Text variant="display" style={{ marginTop: showLogo ? 22 : 8 }}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="body" color="textSecondary" style={styles.subtitle}>
          {subtitle}
        </Text>
      ) : null}
      <View style={styles.body}>{children}</View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: { paddingTop: 8 },
  topBar: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 24 },
  steps: { flex: 1, flexDirection: "row", gap: 6 },
  stepBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  stepBarDone: { backgroundColor: colors.primary },
  subtitle: { marginTop: 8 },
  body: { marginTop: 28 },
});
