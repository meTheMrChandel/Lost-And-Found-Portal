import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { RootStackParamList } from "./types";
import { useAuth } from "../context/AuthContext";
import { AuthNavigator } from "./AuthNavigator";
import { BottomTabNavigator } from "./BottomTabNavigator";
import { ItemDetailScreen } from "../screens/feed/ItemDetailScreen";
import { ChatScreen } from "../screens/chat/ChatScreen";
import { NotificationsScreen } from "../screens/notifications/NotificationsScreen";
import { ValuablesScreen } from "../screens/qr/ValuablesScreen";
import { colors } from "../theme/colors";

const Stack = createNativeStackNavigator<RootStackParamList>();

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
    <NavigationContainer>
      <Stack.Navigator
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
        {!user ? (
          <Stack.Screen
            name="Auth"
            component={AuthNavigator}
            options={{ headerShown: false }}
          />
        ) : (
          <>
            <Stack.Screen
              name="Main"
              component={BottomTabNavigator}
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
          </>
        )}
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
