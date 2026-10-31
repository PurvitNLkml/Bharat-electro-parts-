import { isFresh } from "./freshness";
import { normalizeMpn, trigramSimilarity } from "./mpn";
import type { Listing, PublicListing, SearchParams } from "./types";

export function toPublicListing(listing: Listing, now: Date): PublicListing {
  void now;
  return {
    id: listing.id,
    mpn: listing.mpn,
    manufacturer: listing.manufacturer,
    description: listing.description,
    category: listing.category,
    package: listing.package,
    qty: listing.qty,
    moq: listing.moq,
    gstMode: listing.gstMode,
    leadTime: listing.leadTime,
    dateCode: listing.dateCode,
    city: listing.city,
    state: listing.state,
    lastUpdated: listing.lastUpdated,
    inStock: listing.qty > 0,
  };
}

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((part) => part.length > 1);
}

function scoreListing(listing: Listing, query: string): number {
  const qNorm = normalizeMpn(query);
  if (!query.trim()) return 1;
  if (qNorm && listing.mpnNorm === qNorm) return 100;
  let score = 0;
  if (qNorm && listing.mpnNorm.startsWith(qNorm)) score += 40;
  if (qNorm) score += trigramSimilarity(listing.mpnNorm, qNorm) * 30;
  const haystack = `${listing.mpn} ${listing.manufacturer} ${listing.description} ${listing.category} ${listing.package}`.toLowerCase();
  for (const token of tokens(query)) {
    if (haystack.includes(token)) score += 8;
  }
  if (listing.manufacturer.toLowerCase().includes(query.trim().toLowerCase())) score += 12;
  return score;
}

export function searchListings(listings: Listing[], params: SearchParams, now: Date): PublicListing[] {
  const q = params.q?.trim() ?? "";
  const category = params.category?.trim().toLowerCase() ?? "";
  const city = params.city?.trim().toLowerCase() ?? "";

  return listings
    .filter((listing) => params.includeStale || isFresh(listing.lastUpdated, now))
    .filter((listing) => !category || listing.category === category)
    .filter((listing) => !city || listing.city.toLowerCase() === city)
    .filter((listing) => !params.inStock || listing.qty > 0)
    .map((listing) => ({ listing, score: scoreListing(listing, q) }))
    .filter((row) => !q || row.score >= 8)
    .sort((a, b) => b.score - a.score || b.listing.qty - a.listing.qty || a.listing.mpn.localeCompare(b.listing.mpn))
    .map((row) => toPublicListing(row.listing, now));
}
