import { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

// Shared press-in/press-out feel — quick settle, minimal overshoot. Mirrors the RN Animated.spring
// config previously duplicated across Button/DinnerCard/SponsorDinnerCard/SelectCard (speed ~40,
// bounciness 5-6); Reanimated's spring model is parameterized differently (damping/stiffness rather
// than speed/bounciness), so these are a tuned equivalent, not a literal unit conversion.
const PRESS_SPRING = { damping: 18, stiffness: 280 } as const;

export function usePressScale(pressedScale = 0.97) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return {
    style,
    onPressIn: () => {
      scale.value = withSpring(pressedScale, PRESS_SPRING);
    },
    onPressOut: () => {
      scale.value = withSpring(1, PRESS_SPRING);
    },
  };
}
