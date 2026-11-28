import React from "react";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { AuthProvider } from "./src/context/AuthContext";
import { ActivityProvider } from "./src/context/ActivityContext";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { UpdateGate } from "./src/components/UpdateGate";
import { ToastProvider } from "./src/ui/Toast";

// Keep the splash screen up until the fonts and the saved session are ready
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });

  // Fonts come from the app bundle, so this is near-instant; carry on with system fonts if it fails
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <ToastProvider>
        <AuthProvider>
          <ActivityProvider>
            <UpdateGate>
              <AppNavigator />
            </UpdateGate>
          </ActivityProvider>
        </AuthProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
