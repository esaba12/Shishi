import React, { useEffect } from "react";
import { ViewStyle } from "react-native";
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useReducedMotion } from "@/lib/useReducedMotion";

interface RevealProps {
  children: React.ReactNode;
  delay?: number;
  style?: ViewStyle;
}

// Staggered fade + slide-up entrance. Used to orchestrate a single reveal moment across a screen's
// content (e.g. heading, then each option card in turn) rather than animating everything at once.
export function Reveal({ children, delay = 0, style }: RevealProps) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(delay, withTiming(1, { duration: 420 }));
  }, [progress, delay, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: interpolate(progress.value, [0, 1], [14, 0]) }],
  }));

  return (
    <Animated.View style={[animatedStyle, style]}>
      {children}
    </Animated.View>
  );
}
