import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { LinkingOptions, NavigationContainer } from "@react-navigation/native";
import Constants from "expo-constants";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { RootStackParamList } from "./types";
import { useAuth } from "../context/AuthContext";
import { AuthNavigator } from "./AuthNavigator";
import { BottomTabNavigator } from "./BottomTabNavigator";
import { ItemDetailScreen } from "../screens/feed/ItemDetailScreen";
import { ChatScreen } from "../screens/chat/ChatScreen";
import { ChatListScreen } from "../screens/chat/ChatListScreen";
import { NotificationsScreen } from "../screens/notifications/NotificationsScreen";
import { ValuablesScreen } from "../screens/qr/ValuablesScreen";
import { MyReportsScreen } from "../screens/reports/MyReportsScreen";
import { MyReportDetailScreen } from "../screens/reports/MyReportDetailScreen";
import { FeedbackScreen } from "../screens/profile/FeedbackScreen";
import { AdminCasesScreen } from "../screens/admin/AdminCasesScreen";
import { AdminCaseDetailScreen } from "../screens/admin/AdminCaseDetailScreen";
import { AdminMatchesScreen } from "../screens/admin/AdminMatchesScreen";
import { AdminMatchDetailScreen } from "../screens/admin/AdminMatchDetailScreen";
import { AdminAbuseReportsScreen } from "../screens/admin/AdminAbuseReportsScreen";
import { AdminUsersScreen } from "../screens/admin/AdminUsersScreen";
import { AdminInvitesScreen } from "../screens/admin/AdminInvitesScreen";
import { AdminAuditLogScreen } from "../screens/admin/AdminAuditLogScreen";
import { AdminFeedbackScreen } from "../screens/admin/AdminFeedbackScreen";
import { AdminSettingsScreen } from "../screens/admin/AdminSettingsScreen";
import { WEB_URL } from "../api/client";
import { colors } from "../theme/colors";

const Stack = createNativeStackNavigator<RootStackParamList>();

// Sticker links open the scan result: lostandfound://scan/<uuid>, the printed
// <web app>/scan/<uuid> (the hosted Vercel site, see app.json extra.webUrl), the planned
// https://lostandfound.iitrpr.ac.in/scan/<uuid>, and exp://.../--/scan/<uuid> in Expo Go
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    "lostandfound://",
    ...(WEB_URL ? [WEB_URL] : []),
    "https://lostandfound.iitrpr.ac.in",
    ...(Constants.linkingUri ? [Constants.linkingUri] : []),
  ],
  config: {
    screens: {
      Main: { screens: { QRScan: "scan/:uuid" } },
    },
  },
};

export const AppNavigator: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        initialRouteName="Main"
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTitleStyle: {
            fontWeight: "bold",
            fontSize: 16,
            color: colors.textPrimary,
          },
          headerTintColor: colors.primary,
        }}
      >
        <Stack.Screen
          name="Main"
          component={BottomTabNavigator}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Auth"
          component={AuthNavigator}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ItemDetail"
          component={ItemDetailScreen}
          options={{ title: "Belonging Details" }}
        />
        <Stack.Screen
          name="Chat"
          component={ChatScreen}
          options={({ route }) => ({
            title: route.params.title || "Campus Handover Chat",
          })}
        />
        <Stack.Screen
          name="Messages"
          component={ChatListScreen}
          options={{ title: "Messages" }}
        />
        <Stack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{ title: "Alerts & Notifications" }}
        />
        <Stack.Screen
          name="Valuables"
          component={ValuablesScreen}
          options={{ title: "My Registered Belongings" }}
        />
        <Stack.Screen
          name="MyReports"
          component={MyReportsScreen}
          options={{ title: "My Reports" }}
        />
        <Stack.Screen
          name="MyReportDetail"
          component={MyReportDetailScreen}
          options={{ title: "Report Details" }}
        />
        <Stack.Screen
          name="Feedback"
          component={FeedbackScreen}
          options={{ title: "Send Feedback" }}
        />

        {/* Admin console, reached from the Admin tab (staff accounts only) */}
        <Stack.Screen name="AdminCases" component={AdminCasesScreen} options={{ title: "Case Queue" }} />
        <Stack.Screen name="AdminCaseDetail" component={AdminCaseDetailScreen} options={{ title: "Review Report" }} />
        <Stack.Screen name="AdminMatches" component={AdminMatchesScreen} options={{ title: "Match Queue" }} />
        <Stack.Screen name="AdminMatchDetail" component={AdminMatchDetailScreen} options={{ title: "Match & Handover" }} />
        <Stack.Screen name="AdminAbuseReports" component={AdminAbuseReportsScreen} options={{ title: "Abuse Reports" }} />
        <Stack.Screen name="AdminUsers" component={AdminUsersScreen} options={{ title: "User Moderation" }} />
        <Stack.Screen name="AdminInvites" component={AdminInvitesScreen} options={{ title: "Admin Invites" }} />
        <Stack.Screen name="AdminAuditLog" component={AdminAuditLogScreen} options={{ title: "Audit Log" }} />
        <Stack.Screen name="AdminFeedback" component={AdminFeedbackScreen} options={{ title: "Beta Feedback" }} />
        <Stack.Screen name="AdminSettings" component={AdminSettingsScreen} options={{ title: "Site Settings" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
});
