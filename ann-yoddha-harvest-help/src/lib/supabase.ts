import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const hasValidSupabase =
  typeof supabaseUrl === "string" &&
  typeof supabaseAnonKey === "string" &&
  supabaseUrl.length > 0 &&
  supabaseAnonKey.length > 0 &&
  supabaseUrl !== "https://your-project-ref.supabase.co";

if (!hasValidSupabase) {
  console.warn(
    "Missing or placeholder VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Create a .env with real values from Supabase project settings for auth to work."
  );
}

/** Supabase client; null when env is missing so the app still renders without auth. */
export const supabase: SupabaseClient | null = hasValidSupabase
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;
