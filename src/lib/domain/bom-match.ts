import { isFresh } from "./freshness";
import { normalizeMpn, trigramSimilarity } from "./mpn";
import { toPublicListing } from "./search";
import type { BomLine, Listing, MatchType, PublicListing } from "./types";

export const FUZZY_THRESHOLD = 0.46;

export type AlternateMatch = {
  listing: PublicListing;
  score: number;
  note: string;
};

export type LineMatch = {
  lineId: string;
  type: MatchType;
  score: number;
  listing: PublicListing | null;
  alternates: AlternateMatch[];
};

type Scored = { listing: Listing; score: number; kind: "exact" | "fuzzy"; note: string };

function fuzzyScore(left: string, right: string): number {
  if (!left || !right) return 0;
  if (left === right) return 1;
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  if (shorter.length >= 8 && longer.startsWith(shorter)) return 0.86;
  return trigramSimilarity(left, right);
}

function candidates(line: BomLine, listings: Listing[], now: Date, includeStale: boolean): Scored[] {
  const wanted = normalizeMpn(line.mpn);
  const scored: Scored[] = [];
  for (const listing of listings) {
    if (!includeStale && !isFresh(listing.lastUpdated, now)) continue;
    if (listing.qty <= 0) continue;
    if (wanted && listing.mpnNorm === wanted) {
      scored.push({ listing, score: 1, kind: "exact", note: "Exact MPN" });
      continue;
    }
    const score = fuzzyScore(wanted, listing.mpnNorm);
    if (score >= FUZZY_THRESHOLD) {
      scored.push({
        listing,
        score,
        kind: "fuzzy",
        note: "Similar MPN",
      });
    }
  }
  scored.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "exact" ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    return b.listing.qty - a.listing.qty;
  });
  return scored;
}

export function matchBomLine(line: BomLine, listings: Listing[], now: Date, includeStale = false): LineMatch {
  const ranked = candidates(line, listings, now, includeStale);
  const best = ranked[0];
  if (!best) {
    return { lineId: line.id, type: "none", score: 0, listing: null, alternates: [] };
  }
  const alternates = ranked.slice(1, 4).map((row) => ({
    listing: toPublicListing(row.listing, now),
    score: row.score,
    note: row.kind === "exact" ? "Same MPN, another stock line" : row.note,
  }));
  return {
    lineId: line.id,
    type: best.kind,
    score: best.score,
    listing: toPublicListing(best.listing, now),
    alternates,
  };
}

export function matchBomLines(lines: BomLine[], listings: Listing[], now: Date, includeStale = false): LineMatch[] {
  return lines.map((line) => matchBomLine(line, listings, now, includeStale));
}

export type DiffChange = "added" | "removed" | "qty" | "same";

export type DiffRow = {
  mpn: string;
  manufacturer: string;
  change: DiffChange;
  qtyA: number | null;
  qtyB: number | null;
};

function collapse(lines: BomLine[]): Map<string, { mpn: string; manufacturer: string; qty: number }> {
  const map = new Map<string, { mpn: string; manufacturer: string; qty: number }>();
  for (const line of lines) {
    const key = normalizeMpn(line.mpn) || line.mpn.trim().toLowerCase();
    const current = map.get(key);
    if (current) current.qty += line.qty;
    else map.set(key, { mpn: line.mpn, manufacturer: line.manufacturer, qty: line.qty });
  }
  return map;
}

export function diffBomLines(left: BomLine[], right: BomLine[]): DiffRow[] {
  const a = collapse(left);
  const b = collapse(right);
  const keys = new Set([...a.keys(), ...b.keys()]);
  const rows: DiffRow[] = [];
  for (const key of keys) {
    const from = a.get(key);
    const to = b.get(key);
    let change: DiffChange = "same";
    if (from && !to) change = "removed";
    else if (!from && to) change = "added";
    else if (from && to && from.qty !== to.qty) change = "qty";
    rows.push({
      mpn: (to ?? from)!.mpn,
      manufacturer: (to ?? from)!.manufacturer,
      change,
      qtyA: from?.qty ?? null,
      qtyB: to?.qty ?? null,
    });
  }
  const order: Record<DiffChange, number> = { added: 0, removed: 1, qty: 2, same: 3 };
  rows.sort((x, y) => order[x.change] - order[y.change] || x.mpn.localeCompare(y.mpn));
  return rows;
}
