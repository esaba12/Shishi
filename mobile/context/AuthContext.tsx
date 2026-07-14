import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { isSupabaseConfigured } from "@/lib/env";
import { mockProfile } from "@/data/mock";
import type { HostDetails, Profile, Role, SponsorDetails } from "@/types";

interface AuthContextValue {
  isLoading: boolean;
  isAuthenticated: boolean;
  hasOnboarded: boolean;
  profile: Profile | null;
  hostDetails: HostDetails | null;
  sponsorDetails: SponsorDetails | null;
  pendingPhone: string | null;
  requestOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, code: string) => Promise<void>;
  continueAsDemoUser: () => void;
  completeOnboarding: (input: {
    profile: Partial<Profile> & { name: string };
    roles: Role[];
    hostDetails?: Partial<HostDetails>;
    sponsorDetails?: Partial<SponsorDetails>;
  }) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hostDetails, setHostDetails] = useState<HostDetails | null>(null);
  const [sponsorDetails, setSponsorDetails] = useState<SponsorDetails | null>(null);
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function requestOtp(phone: string) {
    setPendingPhone(phone);
    if (!isSupabaseConfigured) return; // demo mode: verifyOtp accepts any code
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) throw error;
  }

  async function verifyOtp(phone: string, code: string) {
    if (!isSupabaseConfigured) {
      // Demo mode without a Supabase project connected: any 6-digit code proceeds.
      setSession({ user: { id: "demo-user" } } as unknown as Session);
      return;
    }
    const { data, error } = await supabase.auth.verifyOtp({ phone, token: code, type: "sms" });
    if (error) throw error;
    setSession(data.session);
  }

  function continueAsDemoUser() {
    setSession({ user: { id: "demo-user" } } as unknown as Session);
    setProfile(mockProfile);
  }

  async function completeOnboarding(input: {
    profile: Partial<Profile> & { name: string };
    roles: Role[];
    hostDetails?: Partial<HostDetails>;
    sponsorDetails?: Partial<SponsorDetails>;
  }) {
    const userId = session?.user.id ?? "demo-user";
    const nextProfile: Profile = {
      id: userId,
      name: input.profile.name,
      photoUrl: input.profile.photoUrl ?? null,
      age: input.profile.age ?? null,
      gender: input.profile.gender ?? null,
      origin: input.profile.origin ?? null,
      kosherLevel: input.profile.kosherLevel ?? null,
      dietaryPrefs: input.profile.dietaryPrefs ?? null,
      interests: input.profile.interests ?? [],
      funFact: input.profile.funFact ?? null,
      roles: input.roles,
      verificationTier: 1,
    };
    setProfile(nextProfile);
    if (input.roles.includes("host")) {
      setHostDetails({
        bio: input.hostDetails?.bio ?? "",
        homeVibe: input.hostDetails?.homeVibe ?? "",
        dinnersHostedCount: 0,
      });
    }
    if (input.roles.includes("sponsor")) {
      setSponsorDetails({
        whyIGive: input.sponsorDetails?.whyIGive ?? "",
        budgetCeiling: input.sponsorDetails?.budgetCeiling ?? null,
        monthlyBudget: input.sponsorDetails?.monthlyBudget ?? null,
        locationPref: input.sponsorDetails?.locationPref ?? null,
        dinnerTypePrefs: input.sponsorDetails?.dinnerTypePrefs ?? [],
        status: "waitlisted",
      });
    }

    if (isSupabaseConfigured && session) {
      const { error } = await supabase.from("profiles").upsert({
        id: userId,
        name: nextProfile.name,
        photo_url: nextProfile.photoUrl,
        age: nextProfile.age,
        gender: nextProfile.gender,
        origin: nextProfile.origin,
        kosher_level: nextProfile.kosherLevel,
        dietary_prefs: nextProfile.dietaryPrefs,
        interests: nextProfile.interests,
        fun_fact: nextProfile.funFact,
        is_attendee: input.roles.includes("attendee"),
        is_host: input.roles.includes("host"),
        is_sponsor: input.roles.includes("sponsor"),
      });
      if (error) throw error;
      if (input.roles.includes("host")) {
        await supabase.from("host_details").upsert({
          profile_id: userId,
          bio: input.hostDetails?.bio ?? "",
          home_vibe: input.hostDetails?.homeVibe ?? "",
        });
      }
      if (input.roles.includes("sponsor")) {
        await supabase.from("sponsor_details").upsert({
          profile_id: userId,
          why_i_give: input.sponsorDetails?.whyIGive ?? "",
          budget_ceiling: input.sponsorDetails?.budgetCeiling ?? null,
          monthly_budget: input.sponsorDetails?.monthlyBudget ?? null,
          location_pref: input.sponsorDetails?.locationPref ?? null,
          dinner_type_prefs: input.sponsorDetails?.dinnerTypePrefs ?? [],
        });
      }
    }
  }

  async function signOut() {
    if (isSupabaseConfigured) await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setHostDetails(null);
    setSponsorDetails(null);
    setPendingPhone(null);
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      isAuthenticated: Boolean(session),
      hasOnboarded: Boolean(profile),
      profile,
      hostDetails,
      sponsorDetails,
      pendingPhone,
      requestOtp,
      verifyOtp,
      continueAsDemoUser,
      completeOnboarding,
      signOut,
    }),
    [isLoading, session, profile, hostDetails, sponsorDetails, pendingPhone]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
