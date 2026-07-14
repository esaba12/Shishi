import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View, ViewStyle } from "react-native";
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

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const translateY = useRef(new Animated.Value(120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 120, duration: 200, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, [opacity, translateY]);

  const show = useCallback(
    (message: string, tone: Tone = "info") => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ message, tone });
      translateY.setValue(120);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 6 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      timer.current = setTimeout(hide, 3200);
    },
    [hide, opacity, translateY]
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.wrap,
            { bottom: insets.bottom + spacing.lg, transform: [{ translateY }], opacity },
          ]}
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
