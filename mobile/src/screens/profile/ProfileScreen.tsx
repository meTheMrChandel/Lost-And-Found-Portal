import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../../context/AuthContext";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { colors } from "../../theme/colors";

export const ProfileScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const navigation = useNavigation<any>();

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: logout },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {!user ? (
        <View style={styles.guestCard}>
          <View style={styles.guestLogoBadge}>
            <Text style={styles.logoText}>LF</Text>
          </View>
          <Text style={styles.guestTitle}>IIT Ropar Campus Member</Text>
          <Text style={styles.guestSubtitle}>
            Sign in with your institute email to register campus valuables with QR stickers, report belongings, and receive automated matching alerts.
          </Text>
          <Button
            title="Sign In / Register"
            onPress={() => navigation.navigate("Auth")}
            style={{ marginTop: 16 }}
          />
        </View>
      ) : (
        /* Student ID Card */
        <View style={styles.idCard}>
          <View style={styles.idHeader}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoText}>LF</Text>
            </View>
            <View>
              <Text style={styles.instName}>INDIAN INSTITUTE OF TECHNOLOGY ROPAR</Text>
              <Text style={styles.portalTag}>Verified Campus Member</Text>
            </View>
          </View>

          <View style={styles.avatarRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarChar}>{user?.full_name?.charAt(0) || "U"}</Text>
            </View>
            <View style={styles.nameCol}>
              <Text style={styles.fullName}>{user?.full_name || "Campus Member"}</Text>
              <Text style={styles.regNo}>{user?.registration_number || "REGISTRATION NUMBER"}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>INSTITUTE EMAIL</Text>
              <Text style={styles.infoValue}>{user?.email}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>DEPARTMENT</Text>
              <Text style={styles.infoValue}>{user?.department || "CSE"}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Quick Menu Options */}
      <View style={styles.menuSection}>
        <Text style={styles.sectionTitle}>Campus Belongings & Activity</Text>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate("Valuables")}
        >
          <View style={styles.menuIconBox}>
            <Text style={styles.menuEmoji}>🏷️</Text>
          </View>
          <View style={styles.menuTextCol}>
            <Text style={styles.menuLabel}>My Registered Valuables</Text>
            <Text style={styles.menuDesc}>Manage bicycles, laptops & print QR tags</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate("Notifications")}
        >
          <View style={styles.menuIconBox}>
            <Text style={styles.menuEmoji}>🔔</Text>
          </View>
          <View style={styles.menuTextCol}>
            <Text style={styles.menuLabel}>Campus Alerts & Updates</Text>
            <Text style={styles.menuDesc}>Match notifications and case alerts</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate("QRScan")}
        >
          <View style={styles.menuIconBox}>
            <Text style={styles.menuEmoji}>📷</Text>
          </View>
          <View style={styles.menuTextCol}>
            <Text style={styles.menuLabel}>Scan Item Sticker</Text>
            <Text style={styles.menuDesc}>Scan belongings found across campus</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Safety & App Info */}
      <View style={styles.safetyBox}>
        <Text style={styles.safetyTitle}>🛡️ Privacy & Security Guarantee</Text>
        <Text style={styles.safetyText}>
          Your phone number and student credentials are never shown on public feeds or QR sticker scans. All claim handovers are verified securely with one-time verification tokens.
        </Text>
      </View>

      {user ? (
        <Button
          title="Sign Out"
          variant="lost"
          onPress={handleLogout}
          style={styles.logoutBtn}
        />
      ) : (
        <Button
          title="Sign In with IIT Ropar Email"
          onPress={() => navigation.navigate("Auth")}
          style={styles.logoutBtn}
        />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  guestCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  guestLogoBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  guestTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginBottom: 6,
    textAlign: "center",
  },
  guestSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },
  idCard: {
    backgroundColor: "#064E3B",
    borderRadius: 24,
    padding: 20,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 20,
  },
  idHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: colors.textWhite,
    fontSize: 14,
    fontWeight: "bold",
  },
  instName: {
    fontSize: 9,
    fontWeight: "800",
    color: "#6EE7B7",
    letterSpacing: 0.8,
  },
  portalTag: {
    fontSize: 10,
    color: "rgba(255,255,255,0.7)",
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginVertical: 6,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#A7F3D0",
  },
  avatarChar: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.textWhite,
  },
  nameCol: {
    flex: 1,
  },
  fullName: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.textWhite,
  },
  regNo: {
    fontSize: 12,
    color: "#A7F3D0",
    fontWeight: "600",
    letterSpacing: 1,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginVertical: 14,
  },
  infoGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 8,
    fontWeight: "700",
    color: "#6EE7B7",
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textWhite,
    marginTop: 2,
  },
  menuSection: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  menuIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  menuEmoji: {
    fontSize: 18,
  },
  menuTextCol: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 13,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  menuDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  arrow: {
    fontSize: 20,
    color: colors.textMuted,
  },
  safetyBox: {
    backgroundColor: colors.oceanLight,
    borderWidth: 1,
    borderColor: "#BAE6FD",
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
  },
  safetyTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#0369A1",
    marginBottom: 4,
  },
  safetyText: {
    fontSize: 11,
    color: "#0284C7",
    lineHeight: 16,
  },
  logoutBtn: {
    marginTop: 4,
  },
});
