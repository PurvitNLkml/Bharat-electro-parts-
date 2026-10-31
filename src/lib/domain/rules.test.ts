import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { autoMap } from "./columns";
import { gstinChecksum, isValidGstin, isValidIndianMobile } from "./gstin";
import { prepareListingRows } from "./persist";
import { searchListings } from "./search";
import { assertPublishedSheetUrl } from "./sheet-url";
import { parseTabular } from "./tabular";
import { createSeedStore } from "@/lib/demo/seed";
import { STOCK_FIELDS } from "./columns";

const NOW = new Date("2026-10-31T00:00:00Z");

describe("search privacy and freshness", () => {
  it("drops listings that have not been updated for 14 days and hides price breaks and supplier ids", () => {
    const store = createSeedStore(NOW);
    const results = searchListings(store.listings, { q: "" }, NOW);
    const mpns = results.map((row) => row.mpn);
    expect(mpns).toContain("STM32F103C8T6");
    expect(mpns).not.toContain("NE555P");
    const json = JSON.stringify(results);
    expect(json).not.toContain("13.37");
    expect(json).not.toContain("sup_mehta");
    expect(json).not.toContain("priceBreaks");
    expect(json).not.toContain("Mehta Components");
    const staleIncluded = searchListings(store.listings, { q: "NE555P", includeStale: true }, NOW);
    expect(staleIncluded.some((row) => row.mpn === "NE555P")).toBe(true);
  });

  it("filters by category, city, and stock", () => {
    const store = createSeedStore(NOW);
    const rows = searchListings(store.listings, { category: "sensors", city: "Pune", inStock: true }, NOW);
    expect(rows.map((row) => row.mpn)).toContain("BME280");
    expect(rows.every((row) => row.city === "Pune")).toBe(true);
  });
});

describe("GSTIN and sheet links", () => {
  it("checks GSTIN shape and checksum", () => {
    expect(isValidGstin("24AABCM1234R1ZE")).toBe(true);
    expect(isValidGstin("24aabcm1234r1ze")).toBe(true);
    expect(isValidGstin("24AABCM1234R1Z0")).toBe(false);
    expect(isValidGstin("GSTIN")).toBe(false);
    expect(gstinChecksum("27AAPCP5678Q1Z")).toBe("5");
    expect(isValidIndianMobile("+91 98250 11122")).toBe(true);
    expect(isValidIndianMobile("12345")).toBe(false);
  });

  it("allows published Google Sheet CSV links only", () => {
    expect(() =>
      assertPublishedSheetUrl("https://docs.google.com/spreadsheets/d/abc123/export?format=csv"),
    ).not.toThrow();
    expect(() => assertPublishedSheetUrl("https://docs.google.com/spreadsheets/d/e/2PACX-abc/pub?output=csv")).not.toThrow();
    expect(() => assertPublishedSheetUrl("https://example.com/sheet.csv")).toThrow();
    expect(() => assertPublishedSheetUrl("file:///etc/passwd")).toThrow();
    expect(() => assertPublishedSheetUrl("https://docs.google.com/spreadsheets/d/abc123/edit")).toThrow();
  });
});

describe("uploads", () => {
  it("maps columns and reports failed rows without keeping blanks", () => {
    const table = parseTabular(
      "MPN,Manufacturer,Qty,City,State,Category\nSTM32F103C8T6,ST,10,Ahmedabad,Gujarat,microcontrollers\n,,,,,\n,Yageo,5,Ahmedabad,Gujarat,passives\n",
      "stock.csv",
    );
    const mapping = autoMap(table.headers, STOCK_FIELDS);
    expect(mapping.mpn).toBe("MPN");
    expect(mapping.manufacturer).toBe("Manufacturer");
    const prepared = prepareListingRows(
      table.rows.map((row) => ({
        mpn: row[mapping.mpn ?? ""] ?? "",
        manufacturer: row[mapping.manufacturer ?? ""] ?? "",
        category: row[mapping.category ?? ""] ?? "passives",
        qty: Number(row[mapping.qty ?? ""] || 0),
        moq: Number(row[mapping.moq ?? ""] || 0),
        gstMode: "extra" as const,
        city: row[mapping.city ?? ""] ?? "",
        state: row[mapping.state ?? ""] ?? "",
      })),
    );
    expect(prepared.accepted).toHaveLength(1);
    expect(prepared.failed).toHaveLength(1);
    expect(prepared.failed[0]?.reason).toMatch(/MPN/);
  });
});

describe("copy", () => {
  it("never mentions WhyPCB or a numeric saving claim", () => {
    const root = path.resolve(__dirname, "../../..");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        if (entry === "node_modules" || entry === ".next" || entry === ".git" || entry === "coverage" || entry === "package-lock.json") {
          continue;
        }
        const full = path.join(dir, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) walk(full);
        else if (/\.(tsx|md|sql)$/.test(entry) || entry === "en.ts") files.push(full);
      }
    };
    walk(path.join(root, "src/lib/i18n"));
    walk(path.join(root, "src/app"));
    const readme = path.join(root, "README.md");
    if (existsSync(readme)) files.push(readme);
    const text = files.map((file) => readFileSync(file, "utf8")).join("\n");
    expect(text.toLowerCase()).not.toContain("whypcb");
    expect(text).not.toMatch(/\b\d+\s*%/);
    expect(text.toLowerCase()).not.toMatch(/save[sd]?\s+\d+/);
    expect(text.toLowerCase()).not.toMatch(/\b(cheaper|faster|quicker)\b[^.]{0,40}\d+/);
  });
});
