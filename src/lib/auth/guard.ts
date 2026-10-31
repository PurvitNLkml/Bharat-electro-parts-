import "server-only";
import { getSession } from "@/lib/auth/session";
import type { Role, Session } from "@/lib/domain/types";
import { redirect } from "next/navigation";

export async function requireRole(role: Role): Promise<Session> {
  const session = await getSession();
  if (!session || session.role !== role) redirect(`/login?next=/${role}`);
  return session;
}
