import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/context/AuthContext";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { UpdateGate } from "./src/components/UpdateGate";

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <UpdateGate>
          <AppNavigator />
        </UpdateGate>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
