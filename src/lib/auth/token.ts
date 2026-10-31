import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string {
  return process.env.DEMO_SESSION_SECRET || "bep-demo-only-not-for-production";
}

export function signToken(value: string): string {
  const sig = createHmac("sha256", secret()).update(value).digest("base64url");
  return `${value}.${sig}`;
}

export function readToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const split = token.lastIndexOf(".");
  if (split <= 0) return null;
  const value = token.slice(0, split);
  const sig = token.slice(split + 1);
  const expected = createHmac("sha256", secret()).update(value).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  return value;
}

export function signDemoSession(userId: string, maxAgeMs = 14 * 24 * 60 * 60 * 1000): string {
  return signToken(JSON.stringify({ userId, exp: Date.now() + maxAgeMs }));
}

export function readDemoSession(token: string | undefined | null): string | null {
  const value = readToken(token);
  if (!value) return null;
  try {
    const payload = JSON.parse(value) as { userId?: string; exp?: number };
    if (!payload.userId || !payload.exp || payload.exp < Date.now()) return null;
    return payload.userId;
  } catch {
    return null;
  }
}
