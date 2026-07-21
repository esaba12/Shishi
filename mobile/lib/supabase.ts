import "react-native-url-polyfill/auto";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

// Deliberately untyped generic: our hand-written types/database.ts doesn't match the exact
// shape supabase-js needs for full row-level inference, and would fight it into `never`.
// Domain-level typing instead happens at the boundary in lib/api.ts (see rowToDinner, etc.),
// which is also where this gets replaced by real generated types once a project exists.

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase env vars are missing. Copy .env.example to .env and fill in your project's " +
      "URL/anon key before auth or data calls will work."
  );
}

export const supabase = createClient(
  supabaseUrl ?? "https://placeholder.supabase.co",
  supabaseAnonKey ?? "placeholder-anon-key",
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Email auth is magic-link-based for now (see AuthContext.requestOtp) — the browser needs to
      // parse the session out of the redirect URL's hash fragment when the link is clicked. Native
      // has no such URL to parse from (it'd need deep-link handling instead, not built yet), so this
      // stays off there.
      detectSessionInUrl: Platform.OS === "web",
    },
  }
);
