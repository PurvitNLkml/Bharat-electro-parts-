import "server-only";
import { createDemoRepo } from "./demo-repo";
import type { Marketplace } from "./marketplace";
import { createSupabaseRepo } from "./supabase-repo";
import { getStore } from "@/lib/demo/store";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function getRepo(): Promise<Marketplace> {
  if (!isSupabaseConfigured()) return createDemoRepo(getStore());
  return createSupabaseRepo();
}

export function demoMode(): boolean {
  return !isSupabaseConfigured();
}
