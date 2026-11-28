import React, { useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, View } from "react-native";
import Constants from "expo-constants";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import { departmentLabel, profilePhotoUrl, programYearLabel } from "../../api/auth";
import { WEB_URL } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useActivity } from "../../context/ActivityContext";
import {
  Avatar,
  Badge,
  BottomSheet,
  Button,
  ListGroup,
  ListItem,
  Logo,
  ScreenHeader,
  SectionHeader,
  Text,
  useToast,
} from "../../ui";
import {
  Bell,
  ClipboardList,
  ExternalLink,
  EyeOff,
  Handshake,
  LockKeyhole,
  LogOut,
  MessageSquareText,
  Pencil,
  QrCode,
  ScanLine,
  ShieldCheck,
} from "../../ui/icons";
import { colors } from "../../theme/colors";
import { radii, SCREEN_PADDING } from "../../theme/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PRIVACY_POINTS = [
  {
    icon: EyeOff,
    title: "Your contact details stay private",
    body: "Your phone number and email are never shown on the feed or to people who scan your stickers.",
  },
  {
    icon: LockKeyhole,
    title: "Proof only the admins see",
    body: "The private details you add to a lost report are only used by the admin office to check claims.",
  },
  {
    icon: Handshake,
    title: "Verified hand-overs",
    body: "Items are returned through the admin office using a one-time code, so they reach the right person.",
  },
];

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const toast = useToast();
  const { user, logout } = useAuth();
  const { unreadNotifications } = useActivity();
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const version = Constants.expoConfig?.version;

  const signOut = () => {
    Alert.alert("Sign out?", "You'll need your password to sign back in.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          setSigningOut(true);
          await logout();
          setSigningOut(false);
          toast.show("You're signed out");
          navigation.navigate("Main", { screen: "Home" });
        },
      },
    ]);
  };

  const support = (
    <>
      <SectionHeader title="Help & info" style={styles.section} />
      <ListGroup>
        {user ? (
          <ListItem
            title="Send feedback"
            subtitle="Tell the team what works and what doesn't"
            icon={MessageSquareText}
            onPress={() => navigation.navigate("Feedback", { from: "Profile" })}
          />
        ) : null}
        <ListItem
          title="Privacy & safety"
          subtitle="How your details are protected"
          icon={ShieldCheck}
          onPress={() => setPrivacyOpen(true)}
        />
        {WEB_URL ? (
          <ListItem
            title="Open the website"
            subtitle="Lost & Found on the web"
            icon={ExternalLink}
            onPress={() => Linking.openURL(`${WEB_URL}/feed`).catch(() => {})}
          />
        ) : null}
      </ListGroup>
    </>
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Profile" />
      {/* Keyed by account so signing in or out starts again from the top */}
      <ScrollView key={user?.id || "guest"} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!user ? (
          <View style={styles.guest}>
            <Logo size={64} />
            <Text variant="title2" align="center" style={{ marginTop: 18 }}>
              Your campus account
            </Text>
            <Text variant="callout" color="textSecondary" align="center" style={styles.guestBody}>
              Sign in with your IIT Ropar email to report items, register QR stickers for your belongings and chat with
              the admin office.
            </Text>
            <Button
              title="Sign in"
              size="lg"
              fullWidth
              onPress={() => navigation.navigate("Auth")}
              style={{ marginTop: 22 }}
            />
            <Button
              title="Create an account"
              variant="secondary"
              size="lg"
              fullWidth
              onPress={() => navigation.navigate("Auth", { screen: "Register" })}
              style={{ marginTop: 10 }}
            />
          </View>
        ) : (
          <View style={styles.idCard}>
            <View style={styles.idTop}>
              <Avatar name={user.full_name} uri={profilePhotoUrl(user)} size={68} />
              <View style={{ flex: 1 }}>
                <Text variant="title2" numberOfLines={2}>
                  {user.full_name || "Campus member"}
                </Text>
                <Text variant="footnote" color="textSecondary" numberOfLines={1}>
                  {user.registration_number}
                </Text>
                <Text variant="footnote" color="textSecondary" numberOfLines={1}>
                  {user.email}
                </Text>
              </View>
            </View>
            <View style={styles.tags}>
              {user.is_staff ? <Badge label="Campus admin" tone="dark" icon={ShieldCheck} size="md" /> : null}
              {user.department ? <Badge label={departmentLabel(user.department)} size="md" /> : null}
              {user.program_year ? <Badge label={programYearLabel(user.program_year)} size="md" /> : null}
            </View>
            <Button
              title="Edit profile"
              icon={Pencil}
              variant="secondary"
              size="sm"
              onPress={() => navigation.navigate("EditProfile")}
              style={styles.edit}
            />
          </View>
        )}

        {user ? (
          <>
            <SectionHeader title="Your activity" style={styles.section} />
            <ListGroup>
              {user.is_staff ? (
                <ListItem
                  title="My reports"
                  subtitle="Reports you've made yourself"
                  icon={ClipboardList}
                  onPress={() => navigation.navigate("MyReports")}
                />
              ) : null}
              <ListItem
                title="Registered items"
                subtitle="QR stickers for your bike, laptop and more"
                icon={QrCode}
                onPress={() => navigation.navigate("Valuables")}
              />
              <ListItem
                title="Notifications"
                subtitle="Matches, report updates and alerts"
                icon={Bell}
                badge={unreadNotifications}
                onPress={() => navigation.navigate("Notifications")}
              />
              <ListItem
                title="Scan a QR sticker"
                subtitle="See whose tagged item you're holding"
                icon={ScanLine}
                onPress={() => navigation.navigate("QRScan")}
              />
            </ListGroup>
          </>
        ) : (
          <>
            <SectionHeader title="Tools" style={styles.section} />
            <ListGroup>
              <ListItem
                title="Scan a QR sticker"
                subtitle="See whose tagged item you're holding"
                icon={ScanLine}
                onPress={() => navigation.navigate("QRScan")}
              />
            </ListGroup>
          </>
        )}

        {support}

        {user ? (
          <ListGroup style={styles.section}>
            <ListItem
              title={signingOut ? "Signing out…" : "Sign out"}
              icon={LogOut}
              destructive
              onPress={signOut}
              disabled={signingOut}
              right={null}
            />
          </ListGroup>
        ) : null}

        <Text variant="caption" color="textMuted" align="center" style={styles.version}>
          Lost & Found · IIT Ropar{version ? ` · v${version}` : ""}
        </Text>
      </ScrollView>

      <BottomSheet visible={privacyOpen} onClose={() => setPrivacyOpen(false)} title="Privacy & safety">
        <View style={{ gap: 16 }}>
          {PRIVACY_POINTS.map((point) => {
            const Icon = point.icon;
            return (
              <View key={point.title} style={styles.point}>
                <View style={styles.pointIcon}>
                  <Icon size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="headline">{point.title}</Text>
                  <Text variant="footnote" color="textSecondary" style={{ marginTop: 2 }}>
                    {point.body}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
        <Button
          title="Got it"
          variant="secondary"
          size="lg"
          fullWidth
          onPress={() => setPrivacyOpen(false)}
          style={{ marginTop: 22 }}
        />
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: SCREEN_PADDING, paddingBottom: 32 },
  guest: {
    alignItems: "center",
    padding: 24,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  guestBody: { marginTop: 8, maxWidth: 320 },
  idCard: {
    padding: 18,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  idTop: { flexDirection: "row", alignItems: "center", gap: 16 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  edit: { alignSelf: "flex-start", marginTop: 16 },
  section: { marginTop: 22 },
  version: { marginTop: 28 },
  point: { flexDirection: "row", gap: 14 },
  pointIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
});
