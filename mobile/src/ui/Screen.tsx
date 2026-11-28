import React, { useContext, useEffect, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  RefreshControlProps,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HeaderHeightContext } from "@react-navigation/elements";
import { colors } from "../theme/colors";
import { SCREEN_PADDING } from "../theme/tokens";
import { Text } from "./Text";

/** True while the on-screen keyboard is up. */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(Keyboard.isVisible());
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () =>
      setVisible(true),
    );
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () =>
      setVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

interface ScreenProps {
  children: React.ReactNode;
  /** Wrap the content in a ScrollView that keeps focused fields above the keyboard. */
  scroll?: boolean;
  /** Pad for the status bar, for screens without a navigation header. */
  safeTop?: boolean;
  /** Pad for the system navigation bar, for screens that aren't above the tab bar. */
  safeBottom?: boolean;
  /** Pinned under the content and above the keyboard, e.g. a submit button. */
  footer?: React.ReactNode;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  contentStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
}

/** The background, safe areas and keyboard handling every screen needs. */
export const Screen: React.FC<ScreenProps> = ({
  children,
  scroll,
  safeTop,
  safeBottom = true,
  footer,
  refreshControl,
  contentStyle,
  style,
}) => {
  const insets = useSafeAreaInsets();
  // The keyboard's position is measured from the top of the window, the view's from the
  // top of the screen below the navigation header, so offset by the header
  const headerHeight = useContext(HeaderHeightContext) ?? 0;
  const keyboardUp = useKeyboardVisible();
  const bottomInset = safeBottom && !keyboardUp ? insets.bottom : 0;

  const body = scroll ? (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={[styles.content, { paddingBottom: footer ? 20 : 28 + bottomInset }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fill, contentStyle]}>{children}</View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.screen, safeTop && { paddingTop: insets.top }, style]}
      behavior="padding"
      keyboardVerticalOffset={headerHeight}
      enabled={!!scroll || !!footer}
    >
      {body}
      {footer ? <View style={[styles.footer, { paddingBottom: 12 + bottomInset }]}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
};

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Icon buttons at the right. */
  right?: React.ReactNode;
  /** Something before the title, e.g. the logo. */
  left?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Large title at the top of a tab, under the status bar. */
export const ScreenHeader: React.FC<ScreenHeaderProps> = ({ title, subtitle, right, left, style }) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 12 }, style]}>
      {left}
      <View style={{ flex: 1 }}>
        <Text variant="title1" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="footnote" color="textSecondary" numberOfLines={1} style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.headerActions}>{right}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  fill: { flex: 1 },
  content: { paddingHorizontal: SCREEN_PADDING, paddingTop: 16 },
  footer: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 12,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: 12,
    backgroundColor: colors.background,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 6 },
});
