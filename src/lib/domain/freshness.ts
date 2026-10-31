import { FRESHNESS_DAYS } from "./types";

export function isFresh(lastUpdated: string, now: Date): boolean {
  const then = new Date(lastUpdated).getTime();
  if (Number.isNaN(then)) return false;
  return now.getTime() - then <= FRESHNESS_DAYS * 24 * 60 * 60 * 1000;
}

export function daysAgoIso(now: Date, days: number): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}
