import { isValidGstin, isValidIndianMobile, normalizeGstin, normalizeMobile } from "./gstin";
import { normalizeMpn } from "./mpn";
import type { BidInput, ListingInput, PriceBreak, RfqDraftLine, RowFailure, SupplierSignup } from "./types";

export type PreparedListing = {
  input: ListingInput;
  sourceRow: number;
};

export type PreparedListings = {
  accepted: PreparedListing[];
  failed: RowFailure[];
};

function cleanBreaks(breaks: PriceBreak[] | undefined): PriceBreak[] | string {
  const source = breaks ?? [];
  if (source.length > 5) return "A listing can carry at most 5 price breaks.";
  const cleaned: PriceBreak[] = [];
  for (const row of source) {
    if (!Number.isFinite(row.minQty) || !Number.isFinite(row.rate)) {
      return "Each price break needs a quantity and a rate.";
    }
    if (row.minQty <= 0) return "Price break quantity must be above zero.";
    if (row.rate < 0) return "A rate cannot be negative.";
    cleaned.push({ minQty: Math.round(row.minQty), rate: row.rate });
  }
  return cleaned;
}

export function isBlankListing(input: ListingInput): boolean {
  const text = [input.mpn, input.manufacturer, input.description, input.package, input.leadTime, input.dateCode]
    .map((part) => (part ?? "").trim())
    .join("");
  const breaks = input.priceBreaks ?? [];
  return text.length === 0 && input.qty === 0 && input.moq === 0 && breaks.length === 0;
}

export function prepareListingRows(rows: ListingInput[]): PreparedListings {
  const accepted: PreparedListing[] = [];
  const failed: RowFailure[] = [];
  rows.forEach((row, index) => {
    const sourceRow = index + 1;
    if (isBlankListing(row)) return;
    const mpn = row.mpn?.trim() ?? "";
    if (normalizeMpn(mpn).length < 2) {
      failed.push({ row: sourceRow, reason: "MPN is missing or too short." });
      return;
    }
    if (!row.manufacturer?.trim()) {
      failed.push({ row: sourceRow, reason: "Manufacturer is required." });
      return;
    }
    if (!row.category?.trim()) {
      failed.push({ row: sourceRow, reason: "Category is required." });
      return;
    }
    if (!row.city?.trim() || !row.state?.trim()) {
      failed.push({ row: sourceRow, reason: "City and state are required." });
      return;
    }
    if (!Number.isFinite(row.qty) || row.qty < 0 || !Number.isInteger(row.qty)) {
      failed.push({ row: sourceRow, reason: "Quantity must be a whole number of zero or more." });
      return;
    }
    if (!Number.isFinite(row.moq) || row.moq < 0 || !Number.isInteger(row.moq)) {
      failed.push({ row: sourceRow, reason: "MOQ must be a whole number of zero or more." });
      return;
    }
    const breaks = cleanBreaks(row.priceBreaks);
    if (typeof breaks === "string") {
      failed.push({ row: sourceRow, reason: breaks });
      return;
    }
    accepted.push({
      sourceRow,
      input: {
        ...row,
        mpn,
        manufacturer: row.manufacturer.trim(),
        description: row.description?.trim() ?? "",
        category: row.category.trim().toLowerCase(),
        package: row.package?.trim() ?? "",
        leadTime: row.leadTime?.trim() ?? "",
        dateCode: row.dateCode?.trim() ?? "",
        city: row.city.trim(),
        state: row.state.trim(),
        priceBreaks: breaks,
        qty: row.qty,
        moq: row.moq,
      },
    });
  });
  return { accepted, failed };
}

export function validateSupplierSignup(input: SupplierSignup): string | null {
  if (input.companyName.trim().length < 2) return "Enter the company name.";
  if (input.contactPerson.trim().length < 2) return "Enter the contact person.";
  if (!isValidIndianMobile(input.mobile)) return "Enter a 10-digit Indian mobile number.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) return "Enter a valid email.";
  if (!isValidGstin(input.gstin)) return "GSTIN format is not valid. Check the 15 characters and the checksum.";
  if (!input.city.trim() || !input.state.trim()) return "City and state are required.";
  return null;
}

export function normalizeSupplierSignup(input: SupplierSignup): SupplierSignup {
  return {
    ...input,
    companyName: input.companyName.trim(),
    contactPerson: input.contactPerson.trim(),
    mobile: normalizeMobile(input.mobile),
    email: input.email.trim().toLowerCase(),
    gstin: normalizeGstin(input.gstin),
    city: input.city.trim(),
    state: input.state.trim(),
  };
}

export function validateBid(input: BidInput): string | null {
  if (!input.rfqLineId) return "Choose a line.";
  if (input.cantSupply) return null;
  if (input.rate === null || !Number.isFinite(input.rate) || input.rate < 0) {
    return "Enter a rate, or mark the line as can't supply.";
  }
  if (input.moq !== null && (!Number.isFinite(input.moq) || input.moq < 0)) return "MOQ must be zero or more.";
  if (input.stock !== null && (!Number.isFinite(input.stock) || input.stock < 0)) return "Stock must be zero or more.";
  return null;
}

export function meaningfulRfqLines(lines: RfqDraftLine[]): RfqDraftLine[] {
  return lines
    .map((line) => ({
      mpn: line.mpn.trim(),
      manufacturer: line.manufacturer?.trim() ?? "",
      description: line.description?.trim() ?? "",
      qty: line.qty,
    }))
    .filter((line) => line.mpn.length > 0 || line.qty > 0 || (line.description ?? "").length > 0)
    .filter((line) => line.mpn.length > 0 && Number.isFinite(line.qty) && line.qty > 0);
}

export function listingRateFlags(input: ListingInput, peerRates: number[]): string[] {
  const flags: string[] = [];
  const rates = (input.priceBreaks ?? []).map((row) => row.rate);
  if (input.qty > 0 && rates.some((rate) => rate === 0)) {
    flags.push("Stock is listed with a zero rate.");
  }
  const own = rates.find((rate) => rate > 0);
  const peers = peerRates.filter((rate) => rate > 0);
  if (own !== undefined && peers.length >= 2) {
    const sorted = [...peers].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    if (median > 0 && own < median * 0.4) {
      flags.push("Rate sits far from other ready stock of the same MPN.");
    }
  }
  return flags;
}
