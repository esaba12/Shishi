import React from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { StripeProvider } from "@stripe/stripe-react-native";
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
import { ToastProvider } from "@/components/ui/Toast";
import { isStripeConfigured } from "@/lib/env";
import { colors } from "@/constants/theme";
// Side-effect import: sets active locale + RTL direction before anything renders.
import "@/lib/i18n";

function Providers({ children }: { children: React.ReactNode }) {
  if (!isStripeConfigured) return <>{children}</>;
  return (
    <StripeProvider
      publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY as string}
      merchantIdentifier="merchant.org.shishi"
    >
      <>{children}</>
    </StripeProvider>
  );
}

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

  // Hold on the brand background until the type system is ready, so the first paint is already
  // in Frank Ruhl Libre / Rubik rather than a system-font flash.
  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    <SafeAreaProvider>
      <ToastProvider>
        <AuthProvider>
          <Providers>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
          </Providers>
        </AuthProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
