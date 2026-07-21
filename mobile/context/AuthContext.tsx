import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { isSupabaseConfigured, setDemoSessionActive } from "@/lib/env";
import { fetchProfile } from "@/lib/api";
import { mockHostDetails, mockProfile, mockSponsorDetails } from "@/data/mock";
import type { HostDetails, Profile, Role, SponsorDetails } from "@/types";

// Demo mode has no real backend session, so login/onboarding progress is cached here instead —
// otherwise every reload of the app would drop straight back to the persona picker or account
// creation, since the in-memory-only state would reset to signed-out.
const DEMO_CACHE_KEY = "shishi.demoSession.v1";

interface DemoCache {
  profile: Profile | null;
  hostDetails: HostDetails | null;
  sponsorDetails: SponsorDetails | null;
}

async function loadDemoCache(): Promise<DemoCache | null> {
  const raw = await AsyncStorage.getItem(DEMO_CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DemoCache;
  } catch {
    return null;
  }
}

async function saveDemoCache(cache: DemoCache) {
  await AsyncStorage.setItem(DEMO_CACHE_KEY, JSON.stringify(cache));
}

interface AuthContextValue {
  isLoading: boolean;
  isAuthenticated: boolean;
  hasOnboarded: boolean;
  profile: Profile | null;
  hostDetails: HostDetails | null;
  sponsorDetails: SponsorDetails | null;
  pendingEmail: string | null;
  /** `mode` controls whether Supabase is allowed to create a brand-new account for this email.
   *  "signup" (default) creates one if it doesn't exist yet; "login" only sends a link to an
   *  existing account and errors otherwise — see app/(auth)/login.tsx. */
  requestOtp: (email: string, mode?: "signup" | "login") => Promise<void>;
  verifyOtp: (email: string, code: string) => Promise<void>;
  /** `persona` picks which demo profile to load — attendee is the baseline pillar every persona
   *  gets (Discover/RSVP), "host"/"sponsor" additionally grant that role with matching mock details
   *  so the relevant screens (host tools, donor feed) aren't empty. Defaults to plain attendee. */
  continueAsDemoUser: (persona?: Role) => void;
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
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  async function loadRoleDetails(userId: string, roles: Role[]) {
    if (roles.includes("host")) {
      const { data } = await supabase.from("host_details").select("*").eq("profile_id", userId).maybeSingle();
      if (data) {
        setHostDetails({
          bio: data.bio ?? "",
          homeVibe: data.home_vibe ?? "",
          dinnersHostedCount: data.dinners_hosted_count ?? 0,
        });
      }
    }
    if (roles.includes("sponsor")) {
      const { data } = await supabase.from("sponsor_details").select("*").eq("profile_id", userId).maybeSingle();
      if (data) {
        setSponsorDetails({
          whyIGive: data.why_i_give ?? "",
          budgetCeiling: data.budget_ceiling,
          monthlyBudget: data.monthly_budget,
          locationPref: data.location_pref,
          dinnerTypePrefs: data.dinner_type_prefs ?? [],
          status: data.status,
        });
      }
    }
  }

  // Shared by the initial session check, the auth-state listener, and verifyOtp below — all three
  // need to go from "we have a session" to "we know whether this user has a profile yet" before
  // any screen can safely decide between onboarding and the main app (see index.tsx's redirect).
  async function hydrateFromSession(next: Session | null) {
    setDemoSessionActive(false);
    setSession(next);
    if (!next) {
      setProfile(null);
      setHostDetails(null);
      setSponsorDetails(null);
      return;
    }
    const restoredProfile = await fetchProfile(next.user.id);
    setProfile(restoredProfile);
    if (restoredProfile) await loadRoleDetails(next.user.id, restoredProfile.roles);
  }

  useEffect(() => {
    (async () => {
      if (isSupabaseConfigured) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          await hydrateFromSession(data.session);
          setIsLoading(false);
          return;
        }
      }
      // No real Supabase session (or no project connected) — fall back to a cached demo session,
      // e.g. from a previous /demo visit, so reload doesn't bounce a demo user back to the picker.
      const cache = await loadDemoCache();
      if (cache?.profile) {
        setDemoSessionActive(true);
        setSession({ user: { id: "demo-user" } } as unknown as Session);
        setProfile(cache.profile);
        setHostDetails(cache.hostDetails);
        setSponsorDetails(cache.sponsorDetails);
      }
      setIsLoading(false);
    })();

    if (!isSupabaseConfigured) return;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      hydrateFromSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Email magic link for now, not phone: phone auth needs an SMS/WhatsApp provider (Twilio) that
  // isn't fully set up yet (WhatsApp specifically needs Meta Business approval, which isn't
  // instant). Email needs no third-party provider — Supabase sends it directly. It's a magic link,
  // not a typed code, because customizing the email template to show an OTP code requires custom
  // SMTP to be configured first (Supabase's default shared email templates aren't editable); the
  // default "click to sign in" template works as-is. Clicking the link lands back on the site with
  // the session in the URL hash, which lib/supabase.ts's detectSessionInUrl (web only) picks up
  // automatically via onAuthStateChange below — see app/(auth)/email.tsx for the "check your email"
  // state this leads to. Swap back to supabase.auth.signInWithOtp({ phone })/verifyOtp({ phone,
  // type: "sms" }) once phone is ready; nothing else in the app depends on which channel this is.
  async function requestOtp(email: string, mode: "signup" | "login" = "signup") {
    setPendingEmail(email);
    if (!isSupabaseConfigured) return; // demo mode: verifyOtp accepts any code
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: mode === "signup",
        ...(Platform.OS === "web" ? { emailRedirectTo: window.location.origin } : {}),
      },
    });
    if (error) throw error;
  }

  async function verifyOtp(email: string, code: string) {
    if (!isSupabaseConfigured) {
      // Demo mode without a Supabase project connected: any 6-digit code proceeds.
      await hydrateFromSession({ user: { id: "demo-user" } } as unknown as Session);
      return;
    }
    const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    if (error) throw error;
    await hydrateFromSession(data.session);
  }

  function continueAsDemoUser(persona: Role = "attendee") {
    const roles: Role[] = persona === "attendee" ? ["attendee"] : ["attendee", persona];
    const nextProfile = { ...mockProfile, roles };
    const nextHostDetails = roles.includes("host") ? mockHostDetails : null;
    const nextSponsorDetails = roles.includes("sponsor") ? mockSponsorDetails : null;
    setDemoSessionActive(true);
    setSession({ user: { id: "demo-user" } } as unknown as Session);
    setProfile(nextProfile);
    setHostDetails(nextHostDetails);
    setSponsorDetails(nextSponsorDetails);
    saveDemoCache({ profile: nextProfile, hostDetails: nextHostDetails, sponsorDetails: nextSponsorDetails });
  }

  async function completeOnboarding(input: {
    profile: Partial<Profile> & { name: string };
    roles: Role[];
    hostDetails?: Partial<HostDetails>;
    sponsorDetails?: Partial<SponsorDetails>;
  }) {
    const userId = session?.user.id ?? "demo-user";
    const isDemo = userId === "demo-user";
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
    const nextHostDetails: HostDetails | null = input.roles.includes("host")
      ? {
          bio: input.hostDetails?.bio ?? "",
          homeVibe: input.hostDetails?.homeVibe ?? "",
          dinnersHostedCount: 0,
        }
      : null;
    const nextSponsorDetails: SponsorDetails | null = input.roles.includes("sponsor")
      ? {
          whyIGive: input.sponsorDetails?.whyIGive ?? "",
          budgetCeiling: input.sponsorDetails?.budgetCeiling ?? null,
          monthlyBudget: input.sponsorDetails?.monthlyBudget ?? null,
          locationPref: input.sponsorDetails?.locationPref ?? null,
          dinnerTypePrefs: input.sponsorDetails?.dinnerTypePrefs ?? [],
          // The sponsor pillar is live (donor feed + donation flow), not a waitlist, so onboarding
          // activates a sponsor immediately. The schema column still defaults to 'waitlisted' for
          // safety on any row inserted outside this path.
          status: "active",
        }
      : null;
    setProfile(nextProfile);
    setHostDetails(nextHostDetails);
    setSponsorDetails(nextSponsorDetails);
    if (!isSupabaseConfigured || isDemo) {
      await saveDemoCache({ profile: nextProfile, hostDetails: nextHostDetails, sponsorDetails: nextSponsorDetails });
    }

    if (isSupabaseConfigured && session && !isDemo) {
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
          status: "active",
        });
      }
    }
  }

  async function signOut() {
    if (isSupabaseConfigured) await supabase.auth.signOut();
    await AsyncStorage.removeItem(DEMO_CACHE_KEY);
    setDemoSessionActive(false);
    setSession(null);
    setProfile(null);
    setHostDetails(null);
    setSponsorDetails(null);
    setPendingEmail(null);
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      isAuthenticated: Boolean(session),
      hasOnboarded: Boolean(profile),
      profile,
      hostDetails,
      sponsorDetails,
      pendingEmail,
      requestOtp,
      verifyOtp,
      continueAsDemoUser,
      completeOnboarding,
      signOut,
    }),
    [isLoading, session, profile, hostDetails, sponsorDetails, pendingEmail]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
