export const isSupabaseConfigured = Boolean(
  process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

export const isStripeConfigured = Boolean(process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY);
