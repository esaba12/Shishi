import React, { useEffect } from "react";
import { Platform, View } from "react-native";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  FrankRuhlLibre_400Regular,
  FrankRuhlLibre_500Medium,
  FrankRuhlLibre_700Bold,
  FrankRuhlLibre_900Black,
} from "@expo-google-fonts/frank-ruhl-libre";
import {
  Rubik_400Regular,
  Rubik_500Medium,
  Rubik_600SemiBold,
  Rubik_700Bold,
} from "@expo-google-fonts/rubik";
import { AuthProvider } from "@/context/AuthContext";
import { DemoThemeProvider } from "@/context/DemoThemeContext";
import { ToastProvider } from "@/components/ui/Toast";
import { PaymentProvider } from "@/components/PaymentProvider";
import { colors } from "@/constants/theme";
// Side-effect import: sets active locale + RTL direction before anything renders.
import "@/lib/i18n";
import { i18n, isRTL } from "@/lib/i18n";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    FrankRuhlLibre_400Regular,
    FrankRuhlLibre_500Medium,
    FrankRuhlLibre_700Bold,
    FrankRuhlLibre_900Black,
    Rubik_400Regular,
    Rubik_500Medium,
    Rubik_600SemiBold,
    Rubik_700Bold,
  });

  // On web, react-native-web mirrors flexbox from I18nManager, but the document's text direction and
  // language must be set explicitly for correct rendering + accessibility.
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.documentElement.dir = isRTL ? "rtl" : "ltr";
      document.documentElement.lang = i18n.locale;
    }
  }, []);

  // Hold on the brand background until the type system is ready, so the first paint is already
  // in Frank Ruhl Libre / Rubik rather than a system-font flash.
  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    <SafeAreaProvider>
      <ToastProvider>
        <DemoThemeProvider>
          <AuthProvider>
            <PaymentProvider>
              <StatusBar style="dark" />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
            </PaymentProvider>
          </AuthProvider>
        </DemoThemeProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
