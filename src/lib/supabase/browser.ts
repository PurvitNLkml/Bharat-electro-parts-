import { createBrowserClient } from "@supabase/ssr";
import { supabaseKey, supabaseUrl } from "./env";

export function createBrowserSupabase() {
  return createBrowserClient(supabaseUrl(), supabaseKey());
}
