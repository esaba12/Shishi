import React, { useEffect } from "react";
import { ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useReducedMotion } from "@/lib/useReducedMotion";

interface SuccessBurstProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

// Bouncy scale-in + fade — generalized from what was originally just app/(onboarding)/done.tsx's
// completion moment (spring speed 10/bounciness 12, the slowest and bounciest spring in the app).
// Reused wherever a significant action completes, not just onboarding.
export function SuccessBurst({ children, style }: SuccessBurstProps) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(reducedMotion ? 1 : 0.85);
  const opacity = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) {
      scale.value = 1;
      opacity.value = 1;
      return;
    }
    scale.value = withSpring(1, { damping: 9, stiffness: 100 });
    opacity.value = withTiming(1, { duration: 320 });
  }, [reducedMotion, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[animatedStyle, style]}>
      {children}
    </Animated.View>
  );
}
