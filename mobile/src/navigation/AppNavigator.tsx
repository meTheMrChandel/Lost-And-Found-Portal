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
import { NotificationsScreen } from "../screens/notifications/NotificationsScreen";
import { ValuablesScreen } from "../screens/qr/ValuablesScreen";
import { MyReportsScreen } from "../screens/reports/MyReportsScreen";
import { MyReportDetailScreen } from "../screens/reports/MyReportDetailScreen";
import { FeedbackScreen } from "../screens/profile/FeedbackScreen";
import { colors } from "../theme/colors";

const Stack = createNativeStackNavigator<RootStackParamList>();

// Sticker links open the scan result: lostandfound://scan/<uuid>, the printed
// https://lostandfound.iitrpr.ac.in/scan/<uuid>, and exp://.../--/scan/<uuid> in Expo Go
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    "lostandfound://",
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
