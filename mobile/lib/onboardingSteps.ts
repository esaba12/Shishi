import type { Role } from "@/types";

// The onboarding flow always visits role-select then attendee; host/sponsor steps are inserted
// only when the user opted into that role. Kept in one place so the step progress bar shown on
// each screen stays in sync with the actual navigation logic in each screen's handleContinue.
export function onboardingStepCount(roles: Role[]): number {
  return 2 + (roles.includes("host") ? 1 : 0) + (roles.includes("sponsor") ? 1 : 0);
}

export function onboardingStepIndex(
  screen: "role-select" | "attendee" | "host" | "sponsor",
  roles: Role[]
): number {
  if (screen === "role-select") return 1;
  if (screen === "attendee") return 2;
  if (screen === "host") return 3;
  return roles.includes("host") ? 4 : 3; // sponsor
}
