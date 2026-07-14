import React from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "@/constants/theme";
import { useResponsive } from "@/lib/responsive";

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  padded?: boolean;
}

export function Screen({ children, scroll = true, style, padded = true }: ScreenProps) {
  const { contentMaxWidth } = useResponsive();
  // Cap + center content so mobile-first screens read as intentional on desktop web.
  const centered: ViewStyle = { width: "100%", maxWidth: contentMaxWidth, alignSelf: "center" };

  const content = (
    <View style={[!scroll && styles.fill, centered, padded && styles.padded, style]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {content}
          </ScrollView>
        ) : (
          content
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  // Only when not scrolling: fill height so children like the map/FlatList get bounded height.
  fill: {
    flex: 1,
  },
  padded: {
    padding: spacing.lg,
  },
});
