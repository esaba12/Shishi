import React, { useEffect, useRef } from "react";
import { Animated, ViewStyle } from "react-native";
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
  const progress = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(1);
      return;
    }
    const anim = Animated.timing(progress, { toValue: 1, duration: 420, delay, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [progress, delay, reducedMotion]);

  return (
    <Animated.View
      style={[
        {
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}
