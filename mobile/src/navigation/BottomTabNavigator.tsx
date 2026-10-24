import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text, Platform, StyleSheet } from "react-native";
import { MainTabParamList } from "./types";
import { FeedScreen } from "../screens/feed/FeedScreen";
import { ReportLostScreen } from "../screens/reports/ReportLostScreen";
import { ReportFoundScreen } from "../screens/reports/ReportFoundScreen";
import { QRScanScreen } from "../screens/qr/QRScanScreen";
import { ProfileScreen } from "../screens/profile/ProfileScreen";
import { colors } from "../theme/colors";

const Tab = createBottomTabNavigator<MainTabParamList>();

export const BottomTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderLight,
        },
        headerTitleStyle: {
          fontWeight: "bold",
          fontSize: 16,
          color: colors.textPrimary,
        },
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.borderLight,
          height: Platform.OS === "ios" ? 84 : 64,
          paddingBottom: Platform.OS === "ios" ? 28 : 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
        },
      }}
    >
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{
          title: "Public Feed",
          tabBarLabel: "Feed",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>🏠</Text>,
        }}
      />
      <Tab.Screen
        name="ReportLost"
        component={ReportLostScreen}
        options={{
          title: "Report Lost Item",
          tabBarLabel: "Lost",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>🔍</Text>,
        }}
      />
      <Tab.Screen
        name="ReportFound"
        component={ReportFoundScreen}
        options={{
          title: "Report Found Item",
          tabBarLabel: "Found",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>📦</Text>,
        }}
      />
      <Tab.Screen
        name="QRScan"
        component={QRScanScreen}
        options={{
          title: "Scan Campus Valuables",
          tabBarLabel: "Scan QR",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>📷</Text>,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: "Student Profile",
          tabBarLabel: "Profile",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>👤</Text>,
        }}
      />
    </Tab.Navigator>
  );
};
