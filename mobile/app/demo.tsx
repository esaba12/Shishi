import { Redirect } from "expo-router";

// Hidden entry point into demo mode — not linked from the landing screen, reachable only by
// navigating to /demo directly. See app/(auth)/demo-role.tsx for the persona picker itself.
export default function Demo() {
  return <Redirect href="/(auth)/demo-role" />;
}
