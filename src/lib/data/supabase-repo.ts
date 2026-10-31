import { diffBomLines, matchBomLines } from "@/lib/domain/bom-match";
import { CATEGORIES } from "@/lib/domain/categories";
import { isFresh } from "@/lib/domain/freshness";
import { normalizeMpn } from "@/lib/domain/mpn";
import {
  meaningfulRfqLines,
  normalizeSupplierSignup,
  prepareListingRows,
  validateBid,
  validateSupplierSignup,
} from "@/lib/domain/persist";
import { toPublicListing } from "@/lib/domain/search";
import { projectAdminLines, projectBuyerRfq, projectSupplierRfq } from "@/lib/domain/sealed-bid";
import type { Bid, Listing, PublicListing, Role, Supplier, SupplierStatus } from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MarketplaceError, type BomLineInput, type Marketplace, type RouteSuggestion } from "./marketplace";

type LooseResult = { data: unknown; error: { message: string } | null };

type Chain = PromiseLike<LooseResult> & {
  select: (columns?: string) => Chain;
  eq: (column: string, value: unknown) => Chain;
  in: (column: string, value: unknown[]) => Chain;
  order: (column: string, options?: { ascending?: boolean }) => Chain;
  maybeSingle: () => Promise<LooseResult>;
  single: () => Promise<LooseResult>;
};

type Loose = {
  from: (table: string) => {
    select: (columns?: string) => Chain;
    insert: (values: unknown) => Chain;
    update: (values: unknown) => Chain;
    delete: () => Chain;
  };
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<LooseResult>;
  auth: {
    getClaims: () => Promise<{ data: { claims?: { sub?: string; email?: string } } | null; error: { message: string } | null }>;
  };
  storage: SupabaseClient["storage"];
};

function loose(client: SupabaseClient): Loose {
  return client as unknown as Loose;
}

function str(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return value == null ? "" : String(value);
}

function num(row: Record<string, unknown>, key: string): number {
  const value = Number(row[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function nullableNum(row: Record<string, unknown>, key: string): number | null {
  if (row[key] == null || row[key] === "") return null;
  return num(row, key);
}

async function many(query: PromiseLike<LooseResult>): Promise<Record<string, unknown>[]> {
  const { data, error } = await query;
  if (error) throw new MarketplaceError(error.message);
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  return [];
}

async function one(query: Promise<LooseResult>): Promise<Record<string, unknown> | null> {
  const { data, error } = await query;
  if (error) throw new MarketplaceError(error.message);
  if (!data || Array.isArray(data)) return null;
  return data as Record<string, unknown>;
}

async function run(query: PromiseLike<LooseResult>): Promise<void> {
  const { error } = await query;
  if (error) throw new MarketplaceError(error.message);
}

function asListing(row: Record<string, unknown>, priceBreaks: Listing["priceBreaks"] = [], supplierId = ""): Listing {
  return {
    id: str(row, "id"),
    supplierId,
    mpn: str(row, "mpn"),
    mpnNorm: str(row, "mpn_norm") || normalizeMpn(str(row, "mpn")),
    manufacturer: str(row, "manufacturer"),
    description: str(row, "description"),
    category: str(row, "category"),
    package: str(row, "package"),
    qty: num(row, "qty"),
    moq: num(row, "moq"),
    priceBreaks,
    gstMode: str(row, "gst_mode") === "inclusive" ? "inclusive" : "extra",
    leadTime: str(row, "lead_time"),
    dateCode: str(row, "date_code"),
    city: str(row, "city"),
    state: str(row, "state"),
    lastUpdated: str(row, "last_updated"),
    createdAt: str(row, "created_at"),
  };
}

function publicFromRpc(row: Record<string, unknown>): PublicListing {
  return {
    id: str(row, "id"),
    mpn: str(row, "mpn"),
    manufacturer: str(row, "manufacturer"),
    description: str(row, "description"),
    category: str(row, "category"),
    package: str(row, "package"),
    qty: num(row, "qty"),
    moq: num(row, "moq"),
    gstMode: str(row, "gst_mode") === "inclusive" ? "inclusive" : "extra",
    leadTime: str(row, "lead_time"),
    dateCode: str(row, "date_code"),
    city: str(row, "city"),
    state: str(row, "state"),
    lastUpdated: str(row, "last_updated"),
    inStock: Boolean(row.in_stock_now ?? num(row, "qty") > 0),
  };
}

function breaks(value: unknown): Listing["priceBreaks"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    const minQty = Number(record.minQty ?? record.min_qty);
    const rate = Number(record.rate);
    if (!Number.isFinite(minQty) || !Number.isFinite(rate)) return [];
    return [{ minQty, rate }];
  });
}

async function currentUserId(): Promise<string> {
  const db = loose(await createClient());
  const { data, error } = await db.auth.getClaims();
  if (error || !data?.claims?.sub) throw new MarketplaceError("Verify your email before saving the account.");
  return data.claims.sub;
}

export function createSupabaseRepo(): Marketplace {
  const db = async () => loose(await createClient());

  return {
    async search(params) {
      const client = await db();
      const { data, error } = await client.rpc("search_listings", {
        q: params.q ?? "",
        category_slug: params.category ?? "",
        city_name: params.city ?? "",
        in_stock: Boolean(params.inStock),
        include_stale: Boolean(params.includeStale),
      });
      if (error) throw new MarketplaceError(error.message);
      return (Array.isArray(data) ? data : []).map((row) => publicFromRpc(row as Record<string, unknown>));
    },
    async cities() {
      const rows = await many((await db()).from("listings").select("city, last_updated"));
      const now = new Date();
      return [...new Set(rows.filter((row) => isFresh(str(row, "last_updated"), now)).map((row) => str(row, "city")))].sort();
    },
    async categoryCounts() {
      const rows = await many((await db()).from("listings").select("category, qty, last_updated"));
      const now = new Date();
      return CATEGORIES.map((category) => ({
        slug: category.slug,
        name: category.name,
        count: rows.filter((row) => str(row, "category") === category.slug && isFresh(str(row, "last_updated"), now) && num(row, "qty") > 0).length,
      }));
    },
    async part(mpn) {
      const rows = await many((await db()).from("listings").select("*").eq("mpn_norm", normalizeMpn(mpn)));
      const now = new Date();
      const fresh = rows.map((row) => asListing(row)).filter((row) => isFresh(row.lastUpdated, now));
      const first = fresh[0];
      if (!first) return null;
      return {
        mpn: first.mpn,
        manufacturer: first.manufacturer,
        description: first.description,
        category: first.category,
        listings: fresh.map((row) => toPublicListing(row, now)),
      };
    },
    async listingsForSupplier(supplierId) {
      const client = await db();
      const owners = await many(client.from("listing_owners").select("listing_id, supplier_id").eq("supplier_id", supplierId));
      const ids = owners.map((row) => str(row, "listing_id"));
      if (ids.length === 0) return [];
      const [listings, prices] = await Promise.all([
        many(client.from("listings").select("*").in("id", ids)),
        many(client.from("listing_prices").select("*").in("listing_id", ids)),
      ]);
      const priceMap = new Map(prices.map((row) => [str(row, "listing_id"), breaks(row.price_breaks)]));
      return listings
        .map((row) => asListing(row, priceMap.get(str(row, "id")) ?? [], supplierId))
        .sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated));
    },
    async addListings(supplierId, rows) {
      const prepared = prepareListingRows(rows);
      const client = await db();
      const createdIds: string[] = [];
      for (const row of prepared.accepted) {
        const listingId = crypto.randomUUID();
        const inserted = await one(
          client
            .from("listings")
            .insert({
              id: listingId,
              mpn: row.input.mpn,
              manufacturer: row.input.manufacturer,
              description: row.input.description ?? "",
              category: row.input.category,
              package: row.input.package ?? "",
              qty: row.input.qty,
              moq: row.input.moq,
              gst_mode: row.input.gstMode,
              lead_time: row.input.leadTime ?? "",
              date_code: row.input.dateCode ?? "",
              city: row.input.city,
              state: row.input.state,
              last_updated: new Date().toISOString(),
            })
            .select("id")
            .single(),
        );
        const id = inserted ? str(inserted, "id") : listingId;
        if ((row.input.priceBreaks ?? []).length > 0) {
          await run(client.from("listing_prices").insert({ listing_id: id, price_breaks: row.input.priceBreaks }));
        }
        createdIds.push(id);
      }
      return { ok: createdIds.length, failed: prepared.failed, createdIds };
    },
    async touchListing(_supplierId, listingId) {
      await run((await db()).from("listings").update({ last_updated: new Date().toISOString() }).eq("id", listingId));
    },
    async bomsForBuyer(buyerId) {
      const client = await db();
      const boms = await many(client.from("boms").select("*").eq("buyer_id", buyerId).order("created_at"));
      const result = [];
      for (const bom of boms) {
        const revisions = await many(client.from("bom_revisions").select("*").eq("bom_id", str(bom, "id")).order("created_at"));
        const latest = revisions[revisions.length - 1];
        result.push({
          id: str(bom, "id"),
          name: str(bom, "name"),
          createdAt: str(bom, "created_at"),
          revisions: revisions.length,
          latest: latest ? str(latest, "label") : "R1",
        });
      }
      return result;
    },
    async bomDetail(buyerId, bomId, revisionId, diffRevisionId) {
      const client = await db();
      const bom = await one(client.from("boms").select("*").eq("id", bomId).eq("buyer_id", buyerId).maybeSingle());
      if (!bom) return null;
      const revisions = await many(client.from("bom_revisions").select("*").eq("bom_id", bomId).order("created_at"));
      const revision = revisions.find((row) => str(row, "id") === revisionId) ?? revisions[revisions.length - 1];
      if (!revision) return null;
      const raw = await many(client.from("bom_lines").select("*").eq("revision_id", str(revision, "id")).order("line_no"));
      const catalogue = (await many(client.from("listings").select("*"))).map((row) => asListing(row));
      const lines = raw.map((row) => ({
        id: str(row, "id"),
        revisionId: str(row, "revision_id"),
        lineNo: num(row, "line_no"),
        mpn: str(row, "mpn"),
        manufacturer: str(row, "manufacturer"),
        description: str(row, "description"),
        qty: num(row, "qty"),
        refdes: str(row, "refdes"),
        package: str(row, "package"),
      }));
      const matches = matchBomLines(lines, catalogue, new Date());
      const diffAgainst = revisions.find((row) => str(row, "id") === diffRevisionId && str(row, "id") !== str(revision, "id")) ?? null;
      const other = diffAgainst
        ? await many(client.from("bom_lines").select("*").eq("revision_id", str(diffAgainst, "id")))
        : [];
      const otherLines = other.map((row) => ({
        id: str(row, "id"),
        revisionId: str(row, "revision_id"),
        lineNo: num(row, "line_no"),
        mpn: str(row, "mpn"),
        manufacturer: str(row, "manufacturer"),
        description: str(row, "description"),
        qty: num(row, "qty"),
        refdes: str(row, "refdes"),
        package: str(row, "package"),
      }));
      return {
        bom: { id: str(bom, "id"), buyerId, name: str(bom, "name"), createdAt: str(bom, "created_at") },
        revisions: revisions.map((row) => ({
          id: str(row, "id"),
          bomId,
          label: str(row, "label"),
          note: str(row, "note"),
          createdAt: str(row, "created_at"),
        })),
        revision: {
          id: str(revision, "id"),
          bomId,
          label: str(revision, "label"),
          note: str(revision, "note"),
          createdAt: str(revision, "created_at"),
        },
        lines: lines.map((line, index) => ({ ...line, match: matches[index]! })),
        diffAgainst: diffAgainst
          ? {
              id: str(diffAgainst, "id"),
              bomId,
              label: str(diffAgainst, "label"),
              note: str(diffAgainst, "note"),
              createdAt: str(diffAgainst, "created_at"),
            }
          : null,
        diff: diffAgainst ? diffBomLines(otherLines, lines) : null,
      };
    },
    async createBom(buyerId, name, lines, note) {
      const meaningful = cleanBom(lines);
      if (!name.trim()) throw new MarketplaceError("Name the BOM before saving.");
      const client = await db();
      const bomId = crypto.randomUUID();
      const revisionId = crypto.randomUUID();
      await run(client.from("boms").insert({ id: bomId, buyer_id: buyerId, name: name.trim() }));
      await run(client.from("bom_revisions").insert({ id: revisionId, bom_id: bomId, label: "R1", note: note.trim() }));
      await insertBomLines(client, revisionId, meaningful);
      return bomId;
    },
    async addRevision(buyerId, bomId, lines, note) {
      const client = await db();
      const bom = await one(client.from("boms").select("id").eq("id", bomId).eq("buyer_id", buyerId).maybeSingle());
      if (!bom) throw new MarketplaceError("BOM not found.");
      const meaningful = cleanBom(lines);
      const revisions = await many(client.from("bom_revisions").select("id").eq("bom_id", bomId));
      const revisionId = crypto.randomUUID();
      await run(
        client.from("bom_revisions").insert({
          id: revisionId,
          bom_id: bomId,
          label: `R${revisions.length + 1}`,
          note: note.trim(),
        }),
      );
      await insertBomLines(client, revisionId, meaningful);
      return revisionId;
    },
    async rfqsForBuyer(buyerId) {
      const client = await db();
      const rfqs = await many(client.from("rfqs").select("*").eq("buyer_id", buyerId).order("created_at", { ascending: false }));
      const summaries = [];
      for (const rfq of rfqs) {
        const lines = await many(client.from("rfq_lines").select("id").eq("rfq_id", str(rfq, "id")));
        const lineIds = lines.map((line) => str(line, "id"));
        const bids = lineIds.length ? await many(client.from("bids").select("id").in("rfq_line_id", lineIds)) : [];
        summaries.push({
          id: str(rfq, "id"),
          title: str(rfq, "title"),
          status: str(rfq, "status") as "open" | "awarded" | "closed",
          createdAt: str(rfq, "created_at"),
          lines: lines.length,
          quotes: bids.length,
        });
      }
      return summaries;
    },
    async buyerRfq(buyerId, rfqId) {
      const client = await db();
      const rfq = await one(client.from("rfqs").select("*").eq("id", rfqId).eq("buyer_id", buyerId).maybeSingle());
      if (!rfq) return null;
      const lines = await many(client.from("rfq_lines").select("*").eq("rfq_id", rfqId).order("line_no"));
      const lineIds = lines.map((line) => str(line, "id"));
      const bidRows = lineIds.length ? await many(client.from("bids").select("*").in("rfq_line_id", lineIds)) : [];
      const suppliers: Supplier[] = [];
      const bids: Bid[] = [];
      for (const row of bidRows) {
        const { data } = await client.rpc("awarded_supplier", { bid: str(row, "id") });
        const revealed = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : null;
        const supplierId = revealed ? `revealed_${str(row, "id")}` : `sealed_${str(row, "id")}`;
        if (revealed) {
          suppliers.push({
            id: supplierId,
            userId: "",
            companyName: str(revealed, "company_name"),
            contactPerson: "",
            mobile: str(revealed, "mobile"),
            email: str(revealed, "email"),
            gstin: "",
            city: str(revealed, "city"),
            state: "",
            status: "verified",
          });
        }
        bids.push(asBid(row, supplierId));
      }
      return projectBuyerRfq({
        buyerId,
        rfq: {
          id: str(rfq, "id"),
          buyerId,
          title: str(rfq, "title"),
          status: str(rfq, "status") as "open" | "awarded" | "closed",
          notes: str(rfq, "notes"),
          createdAt: str(rfq, "created_at"),
          awardedAt: str(rfq, "awarded_at") || null,
        },
        lines: lines.map(asLine),
        bids,
        suppliers,
      });
    },
    async createRfq(buyerId, title, notes, lines) {
      const kept = meaningfulRfqLines(lines);
      if (!title.trim()) throw new MarketplaceError("Name the RFQ before sending it.");
      if (kept.length === 0) throw new MarketplaceError("Add at least one line with an MPN and a quantity.");
      const client = await db();
      const rfqId = crypto.randomUUID();
      await run(client.from("rfqs").insert({ id: rfqId, buyer_id: buyerId, title: title.trim(), notes: notes.trim(), status: "open" }));
      for (const [index, line] of kept.entries()) {
        await run(
          client.from("rfq_lines").insert({
            id: crypto.randomUUID(),
            rfq_id: rfqId,
            line_no: index + 1,
            mpn: line.mpn,
            manufacturer: line.manufacturer ?? "",
            description: line.description ?? "",
            qty: line.qty,
          }),
        );
      }
      return rfqId;
    },
    async inbox(supplierId) {
      const client = await db();
      const routes = await many(client.from("rfq_routes").select("rfq_id").eq("supplier_id", supplierId));
      const items = [];
      for (const route of routes) {
        const view = await loadSupplierRfq(client, supplierId, str(route, "rfq_id"));
        if (!view) continue;
        items.push({
          id: view.id,
          title: view.title,
          status: view.status,
          buyerCompany: view.buyerCompany,
          buyerCity: view.buyerCity,
          createdAt: view.createdAt,
          lines: view.lines.length,
          yourBids: view.lines.filter((line) => line.yourBid).length,
        });
      }
      return items;
    },
    async supplierRfq(supplierId, rfqId) {
      return loadSupplierRfq(await db(), supplierId, rfqId);
    },
    async submitBid(supplierId, input) {
      const message = validateBid(input);
      if (message) throw new MarketplaceError(message);
      const client = await db();
      const supplier = await one(client.from("suppliers").select("status").eq("id", supplierId).maybeSingle());
      if (!supplier || str(supplier, "status") !== "verified") {
        throw new MarketplaceError("Bids open after Sonani Electronics verifies the supplier account.");
      }
      const existing = await many(client.from("bids").select("id").eq("rfq_line_id", input.rfqLineId));
      const payload = {
        rate: input.cantSupply ? null : input.rate,
        moq: input.cantSupply ? null : input.moq,
        stock: input.cantSupply ? null : input.stock,
        lead_time: input.leadTime.trim(),
        brand: input.brand.trim(),
        alternate_part: input.alternatePart.trim(),
        date_code: input.dateCode.trim(),
        validity: input.validity.trim(),
        remarks: input.remarks.trim(),
        attachment_path: input.attachmentPath,
        attachment_name: input.attachmentName,
        cant_supply: input.cantSupply,
        submitted_at: new Date().toISOString(),
      };
      if (existing[0]) await run(client.from("bids").update(payload).eq("id", str(existing[0], "id")));
      else await run(client.from("bids").insert({ id: crypto.randomUUID(), rfq_line_id: input.rfqLineId, ...payload }));
    },
    async brands() {
      const rows = await many((await db()).from("manufacturers").select("slug, brand_name, description").order("brand_name"));
      return rows.map((row) => ({ slug: str(row, "slug"), brandName: str(row, "brand_name"), description: str(row, "description") }));
    },
    async brand(slug) {
      const client = await db();
      const manufacturer = await one(client.from("manufacturers").select("*").eq("slug", slug).maybeSingle());
      if (!manufacturer) return null;
      return brandFrom(client, manufacturer);
    },
    async manufacturerHome(manufacturerId) {
      const client = await db();
      const manufacturer = await one(client.from("manufacturers").select("*").eq("id", manufacturerId).maybeSingle());
      if (!manufacturer) return null;
      return brandFrom(client, manufacturer);
    },
    async updateManufacturer(manufacturerId, description, website) {
      await run(
        (await db()).from("manufacturers").update({ description: description.trim(), website: website.trim() }).eq("id", manufacturerId),
      );
    },
    async ownSupplier(supplierId) {
      const client = await db();
      const row = await one(client.from("suppliers").select("id, company_name, city, state, status").eq("id", supplierId).maybeSingle());
      if (!row) return null;
      const priv = await one(client.from("supplier_private").select("*").eq("supplier_id", supplierId).maybeSingle());
      return asSupplier({ ...row, ...(priv ?? {}), id: supplierId });
    },
    async adminSuppliers() {
      const rows = await many((await db()).from("admin_supplier_sheet").select("*").order("company_name"));
      return rows.map(asSupplier);
    },
    async setSupplierStatus(supplierId, status: SupplierStatus) {
      await run((await db()).from("suppliers").update({ status }).eq("id", supplierId));
    },
    async manufacturers() {
      const rows = await many((await db()).from("manufacturers").select("*").order("brand_name"));
      return rows.map((row) => ({
        id: str(row, "id"),
        userId: "",
        brandName: str(row, "brand_name"),
        slug: str(row, "slug"),
        description: str(row, "description"),
        website: str(row, "website"),
      }));
    },
    async setAuthorisation(manufacturerId, supplierId, authorised) {
      const client = await db();
      if (authorised) {
        await run(client.from("authorisations").insert({ manufacturer_id: manufacturerId, supplier_id: supplierId }));
      } else {
        await run(client.from("authorisations").delete().eq("manufacturer_id", manufacturerId).eq("supplier_id", supplierId));
      }
    },
    async authorisations() {
      const rows = await many((await db()).from("authorisations").select("*"));
      return rows.map((row) => ({ manufacturerId: str(row, "manufacturer_id"), supplierId: str(row, "supplier_id") }));
    },
    async adminRfqs() {
      const client = await db();
      const rfqs = await many(client.from("rfqs").select("*").order("created_at", { ascending: false }));
      const summaries = [];
      for (const rfq of rfqs) {
        const buyer = await one(client.from("buyers").select("company").eq("id", str(rfq, "buyer_id")).maybeSingle());
        const lines = await many(client.from("rfq_lines").select("id").eq("rfq_id", str(rfq, "id")));
        const sheet = await many(client.from("admin_bid_sheet").select("bid_id").eq("rfq_id", str(rfq, "id")));
        const routes = await many(client.from("rfq_routes").select("supplier_id").eq("rfq_id", str(rfq, "id")));
        summaries.push({
          id: str(rfq, "id"),
          title: str(rfq, "title"),
          status: str(rfq, "status") as "open" | "awarded" | "closed",
          buyerCompany: buyer ? str(buyer, "company") : "",
          createdAt: str(rfq, "created_at"),
          lines: lines.length,
          bids: sheet.length,
          routes: routes.length,
        });
      }
      return summaries;
    },
    async adminRfq(rfqId) {
      const client = await db();
      const rfq = await one(client.from("rfqs").select("*").eq("id", rfqId).maybeSingle());
      if (!rfq) return null;
      const buyer = await one(client.from("buyers").select("company, city").eq("id", str(rfq, "buyer_id")).maybeSingle());
      const lines = await many(client.from("rfq_lines").select("*").eq("rfq_id", rfqId).order("line_no"));
      const sheet = await many(client.from("admin_bid_sheet").select("*").eq("rfq_id", rfqId));
      const suppliers: Supplier[] = sheet.map((row) => ({
        id: str(row, "supplier_id"),
        userId: "",
        companyName: str(row, "supplier_company"),
        contactPerson: "",
        mobile: "",
        email: str(row, "supplier_email"),
        gstin: "",
        city: str(row, "supplier_city"),
        state: "",
        status: (str(row, "supplier_status") || "pending") as SupplierStatus,
      }));
      const uniqueSuppliers = [...new Map(suppliers.map((row) => [row.id, row])).values()];
      const routes = await many(client.from("rfq_routes").select("supplier_id").eq("rfq_id", rfqId));
      return {
        rfq: {
          id: rfqId,
          buyerId: str(rfq, "buyer_id"),
          title: str(rfq, "title"),
          status: str(rfq, "status") as "open" | "awarded" | "closed",
          notes: str(rfq, "notes"),
          createdAt: str(rfq, "created_at"),
          awardedAt: str(rfq, "awarded_at") || null,
        },
        buyerCompany: buyer ? str(buyer, "company") : "",
        buyerCity: buyer ? str(buyer, "city") : "",
        lines: projectAdminLines({
          lines: lines.map(asLine),
          bids: sheet.map((row) => asBid(row, str(row, "supplier_id"))),
          suppliers: uniqueSuppliers,
        }),
        routedSupplierIds: routes.map((row) => str(row, "supplier_id")),
        suggestions: await suggestRoutes(client, lines),
      };
    },
    async routeRfq(rfqId, supplierIds) {
      const client = await db();
      for (const supplierId of supplierIds) {
        const existing = await many(
          client.from("rfq_routes").select("supplier_id").eq("rfq_id", rfqId).eq("supplier_id", supplierId),
        );
        if (existing.length > 0) continue;
        await run(client.from("rfq_routes").insert({ rfq_id: rfqId, supplier_id: supplierId }));
      }
    },
    async award(lineId, bidId) {
      const client = await db();
      await run(client.from("rfq_lines").update({ awarded_bid_id: bidId }).eq("id", lineId));
      const line = await one(client.from("rfq_lines").select("rfq_id").eq("id", lineId).maybeSingle());
      if (!line) return;
      const lines = await many(client.from("rfq_lines").select("awarded_bid_id").eq("rfq_id", str(line, "rfq_id")));
      if (lines.every((row) => str(row, "awarded_bid_id"))) {
        await run(client.from("rfqs").update({ status: "awarded", awarded_at: new Date().toISOString() }).eq("id", str(line, "rfq_id")));
      }
    },
    async closeRfq(rfqId) {
      await run((await db()).from("rfqs").update({ status: "closed" }).eq("id", rfqId));
    },
    async flags() {
      const rows = await many((await db()).from("fraud_flags").select("*").order("created_at", { ascending: false }));
      return rows.map((row) => ({
        id: str(row, "id"),
        entityType: str(row, "entity_type") as "supplier" | "listing" | "bid" | "buyer",
        entityId: str(row, "entity_id"),
        reason: str(row, "reason"),
        createdAt: str(row, "created_at"),
        resolved: Boolean(row.resolved),
      }));
    },
    async resolveFlag(flagId) {
      await run((await db()).from("fraud_flags").update({ resolved: true }).eq("id", flagId));
    },
    async signupSupplier(input) {
      const message = validateSupplierSignup(input);
      if (message) throw new MarketplaceError(message);
      const clean = normalizeSupplierSignup(input);
      const userId = await currentUserId();
      const client = await db();
      const supplierId = crypto.randomUUID();
      await run(client.from("profiles").insert({ id: userId, role: "supplier", name: clean.contactPerson, email: clean.email }));
      await run(
        client.from("suppliers").insert({
          id: supplierId,
          company_name: clean.companyName,
          city: clean.city,
          state: clean.state,
          status: "pending",
        }),
      );
      await run(
        client.from("supplier_private").insert({
          supplier_id: supplierId,
          user_id: userId,
          contact_person: clean.contactPerson,
          mobile: clean.mobile,
          email: clean.email,
          gstin: clean.gstin,
        }),
      );
      return {
        userId,
        email: clean.email,
        role: "supplier" as Role,
        name: clean.contactPerson,
        supplierId,
        buyerId: null,
        manufacturerId: null,
      };
    },
    async signupBuyer(input) {
      const email = input.email.trim().toLowerCase();
      if (!input.name.trim() || !input.company.trim() || !input.city.trim()) {
        throw new MarketplaceError("Name, company, and city are required.");
      }
      const userId = await currentUserId();
      const client = await db();
      const buyerId = crypto.randomUUID();
      await run(client.from("profiles").insert({ id: userId, role: "buyer", name: input.name.trim(), email }));
      await run(
        client.from("buyers").insert({
          id: buyerId,
          user_id: userId,
          name: input.name.trim(),
          company: input.company.trim(),
          email,
          city: input.city.trim(),
          mobile: input.mobile.trim(),
        }),
      );
      return { userId, email, role: "buyer" as Role, name: input.name.trim(), supplierId: null, buyerId, manufacturerId: null };
    },
    async signupManufacturer(input) {
      const email = input.email.trim().toLowerCase();
      if (input.brandName.trim().length < 2) throw new MarketplaceError("Enter the brand name.");
      const userId = await currentUserId();
      const slug = input.brandName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const client = await db();
      const manufacturerId = crypto.randomUUID();
      await run(client.from("profiles").insert({ id: userId, role: "manufacturer", name: input.contactName.trim() || input.brandName.trim(), email }));
      await run(
        client.from("manufacturers").insert({
          id: manufacturerId,
          brand_name: input.brandName.trim(),
          slug,
          description: input.description.trim(),
          website: input.website.trim(),
        }),
      );
      await run(client.from("manufacturer_accounts").insert({ manufacturer_id: manufacturerId, user_id: userId }));
      return {
        userId,
        email,
        role: "manufacturer" as Role,
        name: input.contactName.trim() || input.brandName.trim(),
        supplierId: null,
        buyerId: null,
        manufacturerId,
      };
    },
    async sessionForUser(userId) {
      const client = await db();
      const profile = await one(client.from("profiles").select("*").eq("id", userId).maybeSingle());
      if (!profile) return null;
      const supplier = await one(client.from("supplier_private").select("supplier_id").eq("user_id", userId).maybeSingle());
      const buyer = await one(client.from("buyers").select("id").eq("user_id", userId).maybeSingle());
      const manufacturer = await one(client.from("manufacturer_accounts").select("manufacturer_id").eq("user_id", userId).maybeSingle());
      return {
        userId,
        email: str(profile, "email"),
        role: str(profile, "role") as Role,
        name: str(profile, "name"),
        supplierId: supplier ? str(supplier, "supplier_id") : null,
        buyerId: buyer ? str(buyer, "id") : null,
        manufacturerId: manufacturer ? str(manufacturer, "manufacturer_id") : null,
      };
    },
    async userByEmail(email) {
      const row = await one((await db()).from("profiles").select("*").eq("email", email.trim().toLowerCase()).maybeSingle());
      if (!row) return null;
      return { id: str(row, "id"), email: str(row, "email"), role: str(row, "role") as Role, name: str(row, "name") };
    },
    async saveAttachment(supplierId, file) {
      if (!file.base64) throw new MarketplaceError("The file was empty.");
      if (file.base64.length > 2_000_000) throw new MarketplaceError("Attachments are limited to about 1.5 MB.");
      const safe = file.filename.replace(/[^\w.\-]+/g, "_");
      const path = `${supplierId}/${crypto.randomUUID()}/${safe}`;
      const client = await db();
      const { error } = await client.storage.from("bid-attachments").upload(path, Buffer.from(file.base64, "base64"), {
        contentType: file.contentType || "application/octet-stream",
        upsert: false,
      });
      if (error) throw new MarketplaceError(error.message);
      return { path, name: file.filename };
    },
    async signedAttachmentUrl(_session, path) {
      const client = await db();
      const visible = await many(client.from("bids").select("id").eq("attachment_path", path));
      if (visible.length === 0) return null;
      const signed = await client.storage.from("bid-attachments").createSignedUrl(path, 120);
      if (signed.error || !signed.data?.signedUrl) return null;
      return signed.data.signedUrl;
    },
    async readDemoAttachment() {
      return null;
    },
  };
}

function cleanBom(lines: BomLineInput[]): BomLineInput[] {
  const meaningful = lines
    .map((line) => ({
      mpn: line.mpn.trim(),
      manufacturer: line.manufacturer?.trim() ?? "",
      description: line.description?.trim() ?? "",
      qty: line.qty,
      refdes: line.refdes?.trim() ?? "",
      package: line.package?.trim() ?? "",
    }))
    .filter((line) => line.mpn && line.qty > 0);
  if (meaningful.length === 0) throw new MarketplaceError("Add at least one BOM line with an MPN and a quantity before saving.");
  return meaningful;
}

async function insertBomLines(client: Loose, revisionId: string, lines: BomLineInput[]) {
  for (const [index, line] of lines.entries()) {
    await run(
      client.from("bom_lines").insert({
        id: crypto.randomUUID(),
        revision_id: revisionId,
        line_no: index + 1,
        mpn: line.mpn,
        manufacturer: line.manufacturer ?? "",
        description: line.description ?? "",
        qty: line.qty,
        refdes: line.refdes ?? "",
        package: line.package ?? "",
      }),
    );
  }
}

function asLine(row: Record<string, unknown>) {
  return {
    id: str(row, "id"),
    rfqId: str(row, "rfq_id"),
    lineNo: num(row, "line_no"),
    mpn: str(row, "mpn"),
    manufacturer: str(row, "manufacturer"),
    description: str(row, "description"),
    qty: num(row, "qty"),
    awardedBidId: str(row, "awarded_bid_id") || null,
  };
}

function asBid(row: Record<string, unknown>, supplierId: string): Bid {
  return {
    id: str(row, "id") || str(row, "bid_id"),
    rfqLineId: str(row, "rfq_line_id"),
    supplierId,
    rate: nullableNum(row, "rate"),
    moq: nullableNum(row, "moq"),
    stock: nullableNum(row, "stock"),
    leadTime: str(row, "lead_time"),
    brand: str(row, "brand"),
    alternatePart: str(row, "alternate_part"),
    dateCode: str(row, "date_code"),
    validity: str(row, "validity"),
    remarks: str(row, "remarks"),
    attachmentPath: str(row, "attachment_path") || null,
    attachmentName: str(row, "attachment_name") || null,
    cantSupply: Boolean(row.cant_supply),
    submittedAt: str(row, "submitted_at"),
  };
}

function asSupplier(row: Record<string, unknown>): Supplier {
  return {
    id: str(row, "id"),
    userId: str(row, "user_id"),
    companyName: str(row, "company_name"),
    contactPerson: str(row, "contact_person"),
    mobile: str(row, "mobile"),
    email: str(row, "email"),
    gstin: str(row, "gstin"),
    city: str(row, "city"),
    state: str(row, "state"),
    status: (str(row, "status") || "pending") as SupplierStatus,
  };
}

async function loadSupplierRfq(client: Loose, supplierId: string, rfqId: string) {
  const route = await many(client.from("rfq_routes").select("rfq_id").eq("rfq_id", rfqId).eq("supplier_id", supplierId));
  if (route.length === 0) return null;
  const rfq = await one(client.from("rfqs").select("id, title, status, notes, created_at").eq("id", rfqId).maybeSingle());
  if (!rfq) return null;
  const { data } = await client.rpc("routed_buyer", { rfq: rfqId });
  const buyer = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
  const lines = await many(client.from("rfq_lines").select("*").eq("rfq_id", rfqId).order("line_no"));
  const lineIds = lines.map((line) => str(line, "id"));
  const bids = lineIds.length ? await many(client.from("bids").select("*").in("rfq_line_id", lineIds)) : [];
  return projectSupplierRfq({
    supplierId,
    rfq: {
      id: rfqId,
      buyerId: "",
      title: str(rfq, "title"),
      status: str(rfq, "status") as "open" | "awarded" | "closed",
      notes: str(rfq, "notes"),
      createdAt: str(rfq, "created_at"),
      awardedAt: null,
    },
    buyer: { company: buyer ? str(buyer, "company") : "Buyer", city: buyer ? str(buyer, "city") : "" },
    lines: lines.map(asLine),
    bids: bids.map((row) => asBid(row, supplierId)),
  });
}

async function brandFrom(client: Loose, manufacturer: Record<string, unknown>) {
  const now = new Date();
  const brandName = str(manufacturer, "brand_name");
  const listings = (await many(client.from("listings").select("*")))
    .map((row) => asListing(row))
    .filter((row) => row.manufacturer.toLowerCase() === brandName.toLowerCase() && isFresh(row.lastUpdated, now) && row.qty > 0);
  const { data, error } = await client.rpc("brand_stock", { brand_slug: str(manufacturer, "slug") });
  if (error) throw new MarketplaceError(error.message);
  const grouped = new Map<string, { supplierId: string; companyName: string; city: string; state: string; parts: { mpn: string; qty: number; city: string; package: string }[] }>();
  for (const row of (Array.isArray(data) ? data : []) as Record<string, unknown>[]) {
    const supplierId = str(row, "supplier_id");
    const current = grouped.get(supplierId) ?? {
      supplierId,
      companyName: str(row, "company_name"),
      city: str(row, "city"),
      state: str(row, "state"),
      parts: [],
    };
    current.parts.push({
      mpn: str(row, "mpn"),
      qty: num(row, "qty"),
      city: str(row, "stock_city"),
      package: str(row, "package"),
    });
    grouped.set(supplierId, current);
  }
  const stockists = [...grouped.values()];
  return {
    manufacturer: {
      id: str(manufacturer, "id"),
      userId: "",
      brandName,
      slug: str(manufacturer, "slug"),
      description: str(manufacturer, "description"),
      website: str(manufacturer, "website"),
    },
    parts: listings.map((row) => toPublicListing(row, now)),
    stockists,
  };
}

async function suggestRoutes(client: Loose, lines: Record<string, unknown>[]): Promise<RouteSuggestion[]> {
  const wanted = new Set(lines.map((line) => normalizeMpn(str(line, "mpn"))).filter(Boolean));
  const listings = (await many(client.from("listings").select("id, mpn, mpn_norm, last_updated"))).filter((row) =>
    isFresh(str(row, "last_updated"), new Date()),
  );
  const owners = await many(client.from("listing_owners").select("listing_id, supplier_id"));
  const suppliers = await many(client.from("admin_supplier_sheet").select("id, company_name, city, status"));
  const suggestions: RouteSuggestion[] = [];
  for (const supplier of suppliers.filter((row) => str(row, "status") === "verified")) {
    const owned = new Set(owners.filter((row) => str(row, "supplier_id") === str(supplier, "id")).map((row) => str(row, "listing_id")));
    const hit = listings.find((row) => owned.has(str(row, "id")) && wanted.has(str(row, "mpn_norm") || normalizeMpn(str(row, "mpn"))));
    if (!hit) continue;
    suggestions.push({
      supplierId: str(supplier, "id"),
      companyName: str(supplier, "company_name"),
      city: str(supplier, "city"),
      reason: `Fresh stock of ${str(hit, "mpn")}`,
    });
  }
  return suggestions;
}
