import "react-native-url-polyfill/auto";
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
      detectSessionInUrl: false,
    },
  }
);
