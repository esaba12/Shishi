import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

// Thin wrapper so screens can fire haptics without caring about platform. No-ops on web (there's no
// haptic hardware in a browser), which also avoids any console noise from the native module.
export const haptics = {
  impact() {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },
  success() {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
};
