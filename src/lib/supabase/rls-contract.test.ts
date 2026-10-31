import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.resolve(__dirname, "../../../supabase/migrations/20261031120000_init.sql"),
  "utf8",
);

function tableBody(name: string): string {
  const match = sql.match(new RegExp(`create table public\\.${name} \\(([\\s\\S]*?)\\n\\);`));
  return match?.[1] ?? "";
}

describe("RLS contract", () => {
  it("enables row level security on every public table", () => {
    const tables = [...sql.matchAll(/create table public\.(\w+)/g)].map((match) => match[1]);
    expect(tables.length).toBeGreaterThan(10);
    for (const table of tables) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it("keeps supplier identity off bids and price breaks off the catalogue", () => {
    expect(tableBody("bids")).not.toMatch(/supplier_id/);
    expect(tableBody("listings")).not.toMatch(/supplier_id/);
    expect(tableBody("listings")).not.toMatch(/price_breaks/);
    expect(sql).toContain("jsonb_array_length(price_breaks) <= 5");
    expect(sql).toMatch(/revoke all on table public\.listing_prices from anon, authenticated/);
    expect(sql).not.toMatch(/grant select on public\.listing_prices to anon/);
  });

  it("does not publish a lowest-bid or rank signal", () => {
    expect(sql.toLowerCase()).not.toContain("min(rate)");
    expect(sql.toLowerCase()).not.toContain("rank(");
    expect(sql.toLowerCase()).not.toContain("lowest");
    expect(sql).toContain("private.owns_bid(id)");
    expect(sql).toContain("l.awarded_bid_id = b.id");
  });

  it("keeps security definer functions in the private schema", () => {
    for (const block of sql.split("create or replace function ")) {
      if (!block.startsWith("public.")) continue;
      const header = block.split("as $$")[0] ?? "";
      expect(header.toLowerCase()).not.toContain("security definer");
    }
    expect(sql).toContain("function private.awarded_supplier");
    expect(sql).toContain("Only an administrator can change supplier status");
    expect(sql).not.toContain("user_metadata");
  });

  it("keeps the bid attachment bucket private", () => {
    expect(sql).toContain("'bid-attachments', 'bid-attachments', false");
    expect(sql).toContain("on conflict (id) do update set public = false");
    expect(sql).toContain("private.can_read_bid_file(name)");
  });

  it("refuses self-assigned admin and blank submissions", () => {
    expect(sql).toContain("role in ('buyer', 'supplier', 'manufacturer')");
    expect(sql).toContain("That role cannot be self-assigned");
    expect(sql).toContain("constraint bid_is_a_submission check (cant_supply or rate is not null)");
    expect(sql).toContain("constraint listing_mpn_present");
    expect(sql).toContain("interval '14 days'");
  });
});
