import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography, elevation } from "@/constants/theme";

type Tone = "info" | "success" | "error";
interface ToastState {
  message: string;
  tone: Tone;
}

interface ToastContextValue {
  show: (message: string, tone?: Tone) => void;
}

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

/** Imperative toast — `const { show } = useToast(); show("Couldn't load dinners", "error")`. */
export const useToast = () => useContext(ToastContext);

// Slide-in spring is slower/softer than the UI's press-scale spring (see lib/usePressScale.ts) — a
// toast arriving should feel like it's settling in, not snapping like a button press.
const SLIDE_IN_SPRING = { damping: 16, stiffness: 180 } as const;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const translateY = useSharedValue(120);
  const opacity = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const hide = useCallback(() => {
    translateY.value = withTiming(120, { duration: 200 });
    opacity.value = withTiming(0, { duration: 200 }, (finished) => {
      if (finished) runOnJS(setToast)(null);
    });
  }, [opacity, translateY]);

  const show = useCallback(
    (message: string, tone: Tone = "info") => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ message, tone });
      translateY.value = 120;
      opacity.value = 0;
      translateY.value = withSpring(0, SLIDE_IN_SPRING);
      opacity.value = withTiming(1, { duration: 200 });
      timer.current = setTimeout(hide, 3200);
    },
    [hide, opacity, translateY]
  );

  const value = useMemo(() => ({ show }), [show]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.wrap, { bottom: insets.bottom + spacing.lg }, animatedStyle]}
        >
          <View style={[styles.toast, toneStyles[toast.tone], elevation.overlay]}>
            <Ionicons name={icons[toast.tone]} size={18} color={colors.onBrand} style={styles.icon} />
            <Text style={styles.text} numberOfLines={2}>
              {toast.message}
            </Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

const icons: Record<Tone, keyof typeof Ionicons.glyphMap> = {
  info: "information-circle",
  success: "checkmark-circle",
  error: "alert-circle",
};

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    start: spacing.lg,
    end: spacing.lg,
    alignItems: "center",
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    maxWidth: 480,
  },
  icon: { marginEnd: spacing.sm },
  text: { ...typography.bodyBold, color: colors.onBrand, flexShrink: 1 },
});

const toneStyles: Record<Tone, ViewStyle> = {
  info: { backgroundColor: colors.brandDark },
  success: { backgroundColor: colors.success },
  error: { backgroundColor: colors.danger },
};
