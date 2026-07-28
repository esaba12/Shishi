import { ViewStyle } from "react-native";

// Native no-op — the grain texture is a web-only enhancement (see GrainOverlay.web.tsx). Sourcing a
// tileable noise PNG for native isn't available in this environment, and DesktopLanding is a
// desktop-web-first surface per its own header comment, so this isn't a visible regression on phones.
export function GrainOverlay(_props: { style?: ViewStyle }) {
  return null;
}
