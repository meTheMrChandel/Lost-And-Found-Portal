import React from "react";
import { DefaultTheme, LinkingOptions, NavigationContainer, Theme } from "@react-navigation/native";
import { createNativeStackNavigator, NativeStackNavigationOptions } from "@react-navigation/native-stack";
import Constants from "expo-constants";
import * as SplashScreen from "expo-splash-screen";
import { RootStackParamList } from "./types";
import { useAuth } from "../context/AuthContext";
import { AuthNavigator } from "./AuthNavigator";
import { BottomTabNavigator } from "./BottomTabNavigator";
import { ItemDetailScreen } from "../screens/feed/ItemDetailScreen";
import { ReportLostScreen } from "../screens/reports/ReportLostScreen";
import { ReportFoundScreen } from "../screens/reports/ReportFoundScreen";
import { QRScanScreen } from "../screens/qr/QRScanScreen";
import { ChatScreen } from "../screens/chat/ChatScreen";
import { NewMessageScreen } from "../screens/chat/NewMessageScreen";
import { NotificationsScreen } from "../screens/notifications/NotificationsScreen";
import { ValuablesScreen } from "../screens/qr/ValuablesScreen";
import { RegisterValuableScreen } from "../screens/qr/RegisterValuableScreen";
import { MyReportsScreen } from "../screens/reports/MyReportsScreen";
import { MyReportDetailScreen } from "../screens/reports/MyReportDetailScreen";
import { EditProfileScreen } from "../screens/profile/EditProfileScreen";
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
import { fonts } from "../theme/tokens";

const Stack = createNativeStackNavigator<RootStackParamList>();

// Sticker links open the scan result: lostandfound://scan/<uuid>, the printed
// <web app>/scan/<uuid> (the hosted Vercel site, see app.json extra.webUrl), the planned
// https://lostandfound.iitrpr.ac.in/scan/<uuid>, and exp://.../--/scan/<uuid> in Expo Go.
// The home screen goes underneath, so Back from a scan lands in the app.
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    "lostandfound://",
    ...(WEB_URL ? [WEB_URL] : []),
    "https://lostandfound.iitrpr.ac.in",
    ...(Constants.linkingUri ? [Constants.linkingUri] : []),
  ],
  config: {
    initialRouteName: "Main",
    screens: {
      QRScan: "scan/:uuid",
    },
  },
};

const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.background,
    text: colors.textPrimary,
    border: colors.border,
    notification: colors.lost,
  },
  fonts: {
    regular: { fontFamily: fonts.regular, fontWeight: "400" },
    medium: { fontFamily: fonts.medium, fontWeight: "500" },
    bold: { fontFamily: fonts.semibold, fontWeight: "600" },
    heavy: { fontFamily: fonts.bold, fontWeight: "700" },
  },
};

const screenOptions: NativeStackNavigationOptions = {
  headerStyle: { backgroundColor: colors.background },
  headerShadowVisible: false,
  headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 17, color: colors.textPrimary },
  headerTintColor: colors.textPrimary,
  headerBackButtonDisplayMode: "minimal",
  contentStyle: { backgroundColor: colors.background },
  animation: "slide_from_right",
};

export const AppNavigator: React.FC = () => {
  const { isLoading } = useAuth();

  // The splash screen stays up while the saved session is restored
  if (isLoading) return null;

  return (
    <NavigationContainer
      linking={linking}
      theme={navigationTheme}
      onReady={() => SplashScreen.hideAsync().catch(() => {})}
    >
      <Stack.Navigator initialRouteName="Main" screenOptions={screenOptions}>
        <Stack.Screen name="Main" component={BottomTabNavigator} options={{ headerShown: false }} />
        <Stack.Screen
          name="Auth"
          component={AuthNavigator}
          options={{ headerShown: false, animation: "slide_from_bottom" }}
        />

        <Stack.Screen name="ItemDetail" component={ItemDetailScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ReportLost" component={ReportLostScreen} options={{ title: "Report a lost item" }} />
        <Stack.Screen name="ReportFound" component={ReportFoundScreen} options={{ title: "Report a found item" }} />
        <Stack.Screen
          name="QRScan"
          component={QRScanScreen}
          options={{ headerShown: false, animation: "slide_from_bottom" }}
        />

        <Stack.Screen
          name="Chat"
          component={ChatScreen}
          options={({ route }) => ({ title: route.params.title || "" })}
        />
        <Stack.Screen name="NewMessage" component={NewMessageScreen} options={{ title: "New message" }} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: "Notifications" }} />

        <Stack.Screen name="MyReports" component={MyReportsScreen} options={{ title: "My reports" }} />
        <Stack.Screen name="MyReportDetail" component={MyReportDetailScreen} options={{ title: "Report" }} />
        <Stack.Screen name="Valuables" component={ValuablesScreen} options={{ title: "Registered items" }} />
        <Stack.Screen
          name="RegisterValuable"
          component={RegisterValuableScreen}
          options={{ title: "Register an item" }}
        />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: "Edit profile" }} />
        <Stack.Screen name="Feedback" component={FeedbackScreen} options={{ title: "Send feedback" }} />

        {/* Admin console, reached from the Admin tab (staff accounts only) */}
        <Stack.Screen name="AdminCases" component={AdminCasesScreen} options={{ title: "Case queue" }} />
        <Stack.Screen name="AdminCaseDetail" component={AdminCaseDetailScreen} options={{ title: "Review report" }} />
        <Stack.Screen name="AdminMatches" component={AdminMatchesScreen} options={{ title: "Match queue" }} />
        <Stack.Screen
          name="AdminMatchDetail"
          component={AdminMatchDetailScreen}
          options={{ title: "Match & handover" }}
        />
        <Stack.Screen
          name="AdminAbuseReports"
          component={AdminAbuseReportsScreen}
          options={{ title: "Abuse reports" }}
        />
        <Stack.Screen name="AdminUsers" component={AdminUsersScreen} options={{ title: "Users" }} />
        <Stack.Screen name="AdminInvites" component={AdminInvitesScreen} options={{ title: "Admin invites" }} />
        <Stack.Screen name="AdminAuditLog" component={AdminAuditLogScreen} options={{ title: "Audit log" }} />
        <Stack.Screen name="AdminFeedback" component={AdminFeedbackScreen} options={{ title: "App feedback" }} />
        <Stack.Screen name="AdminSettings" component={AdminSettingsScreen} options={{ title: "Site settings" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
