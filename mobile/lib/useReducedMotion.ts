import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

// Respects the OS/browser "reduce motion" preference so decorative animation (entrance reveals,
// selection glow) can skip itself instead of always running at full length. Falls back to false
// (normal motion) if the platform doesn't implement the check — react-native-web's support varies.
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((value) => mounted && setReduced(value))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.("reduceMotionChanged", (value) => {
      if (mounted) setReduced(value);
    });
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  return reduced;
}
