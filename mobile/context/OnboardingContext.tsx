import React, { createContext, useContext, useMemo, useState } from "react";
import type { HostDetails, Profile, Role, SponsorDetails } from "@/types";

interface OnboardingDraft {
  roles: Role[];
  profile: Partial<Profile>;
  hostDetails: Partial<HostDetails>;
  sponsorDetails: Partial<SponsorDetails>;
}

interface OnboardingContextValue {
  draft: OnboardingDraft;
  setRoles: (roles: Role[]) => void;
  setProfile: (profile: Partial<Profile>) => void;
  setHostDetails: (details: Partial<HostDetails>) => void;
  setSponsorDetails: (details: Partial<SponsorDetails>) => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

const initialDraft: OnboardingDraft = {
  roles: [],
  profile: {},
  hostDetails: {},
  sponsorDetails: {},
};

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<OnboardingDraft>(initialDraft);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      draft,
      setRoles: (roles) => setDraft((d) => ({ ...d, roles })),
      setProfile: (profile) => setDraft((d) => ({ ...d, profile: { ...d.profile, ...profile } })),
      setHostDetails: (hostDetails) =>
        setDraft((d) => ({ ...d, hostDetails: { ...d.hostDetails, ...hostDetails } })),
      setSponsorDetails: (sponsorDetails) =>
        setDraft((d) => ({ ...d, sponsorDetails: { ...d.sponsorDetails, ...sponsorDetails } })),
    }),
    [draft]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}
