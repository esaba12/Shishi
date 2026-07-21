export const isSupabaseConfigured = Boolean(
  process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

export const isStripeConfigured = Boolean(process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY);

// Whether the *active* session is the local-only demo user rather than a real Supabase Auth session.
// isSupabaseConfigured alone used to be a reliable "use mock data" signal, but once a project is
// connected, continueAsDemoUser (AuthContext) still fakes a session in memory without ever
// authenticating against Supabase — so real queries would go out as `anon` and get RLS-denied. Set by
// AuthContext whenever the session changes; read by lib/api.ts to route demo sessions to mock data too.
let demoSessionActive = false;

export function setDemoSessionActive(active: boolean) {
  demoSessionActive = active;
}

export function isDemoSessionActive() {
  return demoSessionActive;
}
