import "server-only";
import { cookies } from "next/headers";
import { getRepo } from "@/lib/data";
import type { Session } from "@/lib/domain/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { readDemoSession, signDemoSession } from "./token";

const COOKIE = "bep_demo";

export async function getSession(): Promise<Session | null> {
  if (!isSupabaseConfigured()) {
    const token = (await cookies()).get(COOKIE)?.value;
    const userId = readDemoSession(token);
    if (!userId) return null;
    return (await getRepo()).sessionForUser(userId);
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return null;
  return (await getRepo()).sessionForUser(userId);
}

export async function setDemoCookie(userId: string) {
  const jar = await cookies();
  jar.set(COOKIE, signDemoSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 14 * 24 * 60 * 60,
  });
}

export async function clearDemoCookie() {
  (await cookies()).delete(COOKIE);
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new Error("Sign in to continue.");
  return session;
}
