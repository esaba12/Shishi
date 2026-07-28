import React from "react";
import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "@/constants/theme";
import { t } from "@/lib/i18n";
import { useResponsive } from "@/lib/responsive";
import { useAuth } from "@/context/AuthContext";

export default function TabsLayout() {
  const { isDesktop } = useResponsive();
  const { isLoading, isAuthenticated } = useAuth();

  // Mirrors app/index.tsx's own auth gate: this layout stays mounted across every tab, so if the
  // session ever goes away while a tab is focused (sign-out, or an expired session caught by
  // AuthContext's listener), leaving here has to be handled here too — replace("/") from deep
  // inside a tab collides with (tabs)/index also resolving to "/" and never actually navigates out.
  if (isLoading) return null;
  if (!isAuthenticated) return <Redirect href="/(auth)/welcome" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textSecondary,
        // React Navigation 7: a left sidebar rail on desktop, bottom tabs on mobile/tablet web.
        tabBarPosition: isDesktop ? "left" : "bottom",
        tabBarVariant: isDesktop ? "material" : "uikit",
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 12 },
        tabBarStyle: isDesktop
          ? { width: 232, backgroundColor: colors.surface, borderRightColor: colors.border }
          : { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("nav.discover"),
          tabBarIcon: ({ color, size }) => <Ionicons name="search" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="my-dinners"
        options={{
          title: t("nav.myDinners"),
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t("nav.messages"),
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-ellipses" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="sponsor"
        options={{
          title: t("nav.sponsor"),
          tabBarIcon: ({ color, size }) => <Ionicons name="heart" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("nav.profile"),
          tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
