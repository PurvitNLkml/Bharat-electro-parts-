import { diffBomLines, matchBomLines } from "@/lib/domain/bom-match";
import { CATEGORIES } from "@/lib/domain/categories";
import { isFresh } from "@/lib/domain/freshness";
import { normalizeMpn } from "@/lib/domain/mpn";
import {
  listingRateFlags,
  meaningfulRfqLines,
  normalizeSupplierSignup,
  prepareListingRows,
  validateBid,
  validateSupplierSignup,
} from "@/lib/domain/persist";
import { searchListings, toPublicListing } from "@/lib/domain/search";
import { projectAdminLines, projectBuyerRfq, projectSupplierRfq } from "@/lib/domain/sealed-bid";
import { signToken } from "@/lib/auth/token";
import type { Listing, ListingInput, RfqDraftLine, Session, Store, SupplierStatus } from "@/lib/domain/types";
import { MarketplaceError, type BomLineInput, type Marketplace } from "./marketplace";

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function sessionFrom(store: Store, userId: string): Session | null {
  const user = store.users.find((row) => row.id === userId);
  if (!user) return null;
  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    supplierId: store.suppliers.find((row) => row.userId === user.id)?.id ?? null,
    buyerId: store.buyers.find((row) => row.userId === user.id)?.id ?? null,
    manufacturerId: store.manufacturers.find((row) => row.userId === user.id)?.id ?? null,
  };
}

function assertLines(lines: BomLineInput[]): BomLineInput[] {
  const kept = lines
    .map((line) => ({
      mpn: line.mpn.trim(),
      manufacturer: line.manufacturer?.trim() ?? "",
      description: line.description?.trim() ?? "",
      qty: line.qty,
      refdes: line.refdes?.trim() ?? "",
      package: line.package?.trim() ?? "",
    }))
    .filter((line) => line.mpn || line.description || line.qty);
  const meaningful = kept.filter((line) => line.mpn && line.qty > 0);
  if (meaningful.length === 0) {
    throw new MarketplaceError("Add at least one BOM line with an MPN and a quantity before saving.");
  }
  return meaningful;
}

export function createDemoRepo(store: Store, clock: () => Date = () => new Date()): Marketplace {
  const brandPage = (manufacturerId: string) => {
    const manufacturer = store.manufacturers.find((row) => row.id === manufacturerId);
    if (!manufacturer) return null;
    const now = clock();
    const parts = store.listings
      .filter(
        (row) =>
          row.manufacturer.toLowerCase() === manufacturer.brandName.toLowerCase() && isFresh(row.lastUpdated, now) && row.qty > 0,
      )
      .map((row) => toPublicListing(row, now));
    const stockists = store.authorisations
      .filter((row) => row.manufacturerId === manufacturer.id)
      .map((row) => store.suppliers.find((supplier) => supplier.id === row.supplierId))
      .filter((supplier): supplier is NonNullable<typeof supplier> => Boolean(supplier && supplier.status === "verified"))
      .map((supplier) => ({
        supplierId: supplier.id,
        companyName: supplier.companyName,
        city: supplier.city,
        state: supplier.state,
        parts: store.listings
          .filter(
            (row) =>
              row.supplierId === supplier.id &&
              row.manufacturer.toLowerCase() === manufacturer.brandName.toLowerCase() &&
              isFresh(row.lastUpdated, now) &&
              row.qty > 0,
          )
          .map((row) => ({ mpn: row.mpn, qty: row.qty, city: row.city, package: row.package })),
      }))
      .filter((row) => row.parts.length > 0);
    return { manufacturer, parts, stockists };
  };

  return {
    async search(params) {
      return searchListings(store.listings, params, clock());
    },
    async cities() {
      const now = clock();
      return [...new Set(store.listings.filter((row) => isFresh(row.lastUpdated, now)).map((row) => row.city))].sort();
    },
    async categoryCounts() {
      const now = clock();
      return CATEGORIES.map((category) => ({
        slug: category.slug,
        name: category.name,
        count: store.listings.filter((row) => row.category === category.slug && isFresh(row.lastUpdated, now) && row.qty > 0).length,
      }));
    },
    async part(mpn) {
      const wanted = normalizeMpn(mpn);
      const now = clock();
      const rows = store.listings.filter((row) => row.mpnNorm === wanted && isFresh(row.lastUpdated, now));
      const first = rows[0];
      if (!first) return null;
      return {
        mpn: first.mpn,
        manufacturer: first.manufacturer,
        description: first.description,
        category: first.category,
        listings: rows.map((row) => toPublicListing(row, now)),
      };
    },
    async listingsForSupplier(supplierId) {
      return store.listings
        .filter((row) => row.supplierId === supplierId)
        .sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated));
    },
    async addListings(supplierId, rows) {
      const supplier = store.suppliers.find((row) => row.id === supplierId);
      if (!supplier) throw new MarketplaceError("Supplier account not found.");
      const prepared = prepareListingRows(rows);
      const createdIds: string[] = [];
      const now = clock();
      for (const row of prepared.accepted) {
        const listingId = id("lst");
        const listing: Listing = {
          id: listingId,
          supplierId,
          mpn: row.input.mpn,
          mpnNorm: normalizeMpn(row.input.mpn),
          manufacturer: row.input.manufacturer,
          description: row.input.description ?? "",
          category: row.input.category,
          package: row.input.package ?? "",
          qty: row.input.qty,
          moq: row.input.moq,
          priceBreaks: row.input.priceBreaks ?? [],
          gstMode: row.input.gstMode,
          leadTime: row.input.leadTime ?? "",
          dateCode: row.input.dateCode ?? "",
          city: row.input.city,
          state: row.input.state,
          lastUpdated: now.toISOString(),
          createdAt: now.toISOString(),
        };
        store.listings.push(listing);
        createdIds.push(listingId);
        const peers = store.listings
          .filter((item) => item.id !== listingId && item.mpnNorm === listing.mpnNorm)
          .flatMap((item) => item.priceBreaks.map((brk) => brk.rate));
        for (const reason of listingRateFlags(row.input, peers)) {
          store.flags.push({
            id: id("flag"),
            entityType: "listing",
            entityId: listingId,
            reason,
            createdAt: now.toISOString(),
            resolved: false,
          });
        }
      }
      return { ok: createdIds.length, failed: prepared.failed, createdIds };
    },
    async touchListing(supplierId, listingId) {
      const listing = store.listings.find((row) => row.id === listingId && row.supplierId === supplierId);
      if (!listing) throw new MarketplaceError("That stock line is not on your account.");
      listing.lastUpdated = clock().toISOString();
    },
    async bomsForBuyer(buyerId) {
      return store.boms
        .filter((row) => row.buyerId === buyerId)
        .map((bom) => {
          const revisions = store.bomRevisions.filter((row) => row.bomId === bom.id);
          const latest = revisions[revisions.length - 1];
          return {
            id: bom.id,
            name: bom.name,
            createdAt: bom.createdAt,
            revisions: revisions.length,
            latest: latest?.label ?? "R1",
          };
        });
    },
    async bomDetail(buyerId, bomId, revisionId, diffRevisionId) {
      const bom = store.boms.find((row) => row.id === bomId && row.buyerId === buyerId);
      if (!bom) return null;
      const revisions = store.bomRevisions.filter((row) => row.bomId === bom.id);
      const revision = revisions.find((row) => row.id === revisionId) ?? revisions[revisions.length - 1];
      if (!revision) return null;
      const raw = store.bomLines.filter((row) => row.revisionId === revision.id).sort((a, b) => a.lineNo - b.lineNo);
      const matches = matchBomLines(raw, store.listings, clock());
      const lines = raw.map((row, index) => ({ ...row, match: matches[index]! }));
      const diffAgainst = revisions.find((row) => row.id === diffRevisionId && row.id !== revision.id) ?? null;
      const diff = diffAgainst
        ? diffBomLines(
            store.bomLines.filter((row) => row.revisionId === diffAgainst.id),
            raw,
          )
        : null;
      return { bom, revisions, revision, lines, diffAgainst, diff };
    },
    async createBom(buyerId, name, lines, note) {
      const meaningful = assertLines(lines);
      if (!name.trim()) throw new MarketplaceError("Name the BOM before saving.");
      const now = clock().toISOString();
      const bomId = id("bom");
      const revisionId = id("rev");
      store.boms.push({ id: bomId, buyerId, name: name.trim(), createdAt: now });
      store.bomRevisions.push({ id: revisionId, bomId, label: "R1", note: note.trim(), createdAt: now });
      meaningful.forEach((line, index) => {
        store.bomLines.push({
          id: id("bl"),
          revisionId,
          lineNo: index + 1,
          mpn: line.mpn,
          manufacturer: line.manufacturer ?? "",
          description: line.description ?? "",
          qty: line.qty,
          refdes: line.refdes ?? "",
          package: line.package ?? "",
        });
      });
      return bomId;
    },
    async addRevision(buyerId, bomId, lines, note) {
      const bom = store.boms.find((row) => row.id === bomId && row.buyerId === buyerId);
      if (!bom) throw new MarketplaceError("BOM not found.");
      const meaningful = assertLines(lines);
      const revisions = store.bomRevisions.filter((row) => row.bomId === bomId);
      const now = clock().toISOString();
      const revisionId = id("rev");
      store.bomRevisions.push({
        id: revisionId,
        bomId,
        label: `R${revisions.length + 1}`,
        note: note.trim(),
        createdAt: now,
      });
      meaningful.forEach((line, index) => {
        store.bomLines.push({
          id: id("bl"),
          revisionId,
          lineNo: index + 1,
          mpn: line.mpn,
          manufacturer: line.manufacturer ?? "",
          description: line.description ?? "",
          qty: line.qty,
          refdes: line.refdes ?? "",
          package: line.package ?? "",
        });
      });
      return revisionId;
    },
    async rfqsForBuyer(buyerId) {
      return store.rfqs
        .filter((row) => row.buyerId === buyerId)
        .map((rfq) => {
          const lines = store.rfqLines.filter((row) => row.rfqId === rfq.id);
          const quotes = store.bids.filter((bid) => lines.some((line) => line.id === bid.rfqLineId)).length;
          return { id: rfq.id, title: rfq.title, status: rfq.status, createdAt: rfq.createdAt, lines: lines.length, quotes };
        });
    },
    async buyerRfq(buyerId, rfqId) {
      const rfq = store.rfqs.find((row) => row.id === rfqId);
      if (!rfq) return null;
      return projectBuyerRfq({
        buyerId,
        rfq,
        lines: store.rfqLines,
        bids: store.bids,
        suppliers: store.suppliers,
      });
    },
    async createRfq(buyerId, title, notes, lines) {
      const kept = meaningfulRfqLines(lines);
      if (!title.trim()) throw new MarketplaceError("Name the RFQ before sending it.");
      if (kept.length === 0) throw new MarketplaceError("Add at least one line with an MPN and a quantity.");
      const now = clock().toISOString();
      const rfqId = id("rfq");
      store.rfqs.push({
        id: rfqId,
        buyerId,
        title: title.trim(),
        status: "open",
        notes: notes.trim(),
        createdAt: now,
        awardedAt: null,
      });
      kept.forEach((line, index) => {
        store.rfqLines.push({
          id: id("rfl"),
          rfqId,
          lineNo: index + 1,
          mpn: line.mpn,
          manufacturer: line.manufacturer ?? "",
          description: line.description ?? "",
          qty: line.qty,
          awardedBidId: null,
        });
      });
      return rfqId;
    },
    async inbox(supplierId) {
      const supplier = store.suppliers.find((row) => row.id === supplierId);
      if (!supplier) return [];
      return store.routes
        .filter((row) => row.supplierId === supplierId)
        .map((route) => store.rfqs.find((rfq) => rfq.id === route.rfqId))
        .filter((rfq): rfq is NonNullable<typeof rfq> => Boolean(rfq))
        .map((rfq) => {
          const buyer = store.buyers.find((row) => row.id === rfq.buyerId);
          const view = projectSupplierRfq({
            supplierId,
            rfq,
            buyer: { company: buyer?.company ?? "Buyer", city: buyer?.city ?? "" },
            lines: store.rfqLines,
            bids: store.bids,
          });
          return {
            id: rfq.id,
            title: rfq.title,
            status: rfq.status,
            buyerCompany: view.buyerCompany,
            buyerCity: view.buyerCity,
            createdAt: rfq.createdAt,
            lines: view.lines.length,
            yourBids: view.lines.filter((line) => line.yourBid).length,
          };
        });
    },
    async supplierRfq(supplierId, rfqId) {
      const routed = store.routes.some((row) => row.rfqId === rfqId && row.supplierId === supplierId);
      if (!routed) return null;
      const rfq = store.rfqs.find((row) => row.id === rfqId);
      if (!rfq) return null;
      const buyer = store.buyers.find((row) => row.id === rfq.buyerId);
      return projectSupplierRfq({
        supplierId,
        rfq,
        buyer: { company: buyer?.company ?? "Buyer", city: buyer?.city ?? "" },
        lines: store.rfqLines,
        bids: store.bids,
      });
    },
    async submitBid(supplierId, input) {
      const supplier = store.suppliers.find((row) => row.id === supplierId);
      if (!supplier) throw new MarketplaceError("Supplier account not found.");
      if (supplier.status !== "verified") {
        throw new MarketplaceError("Bids open after Sonani Electronics verifies the supplier account.");
      }
      const message = validateBid(input);
      if (message) throw new MarketplaceError(message);
      const line = store.rfqLines.find((row) => row.id === input.rfqLineId);
      if (!line) throw new MarketplaceError("That RFQ line does not exist.");
      const routed = store.routes.some((row) => row.rfqId === line.rfqId && row.supplierId === supplierId);
      if (!routed) throw new MarketplaceError("This RFQ was not routed to your account.");
      if (line.awardedBidId) throw new MarketplaceError("This line has already been awarded.");
      const existing = store.bids.find((row) => row.rfqLineId === line.id && row.supplierId === supplierId);
      const now = clock().toISOString();
      const next = {
        rate: input.cantSupply ? null : input.rate,
        moq: input.cantSupply ? null : input.moq,
        stock: input.cantSupply ? null : input.stock,
        leadTime: input.leadTime.trim(),
        brand: input.brand.trim(),
        alternatePart: input.alternatePart.trim(),
        dateCode: input.dateCode.trim(),
        validity: input.validity.trim(),
        remarks: input.remarks.trim(),
        attachmentPath: input.attachmentPath,
        attachmentName: input.attachmentName,
        cantSupply: input.cantSupply,
        submittedAt: now,
      };
      if (existing) Object.assign(existing, next);
      else store.bids.push({ id: id("bid"), rfqLineId: line.id, supplierId, ...next });
    },
    async brands() {
      return store.manufacturers.map((row) => ({
        slug: row.slug,
        brandName: row.brandName,
        description: row.description,
      }));
    },
    async brand(slug) {
      const manufacturer = store.manufacturers.find((row) => row.slug === slug);
      if (!manufacturer) return null;
      return brandPage(manufacturer.id);
    },
    async manufacturerHome(manufacturerId) {
      return brandPage(manufacturerId);
    },
    async updateManufacturer(manufacturerId, description, website) {
      const manufacturer = store.manufacturers.find((row) => row.id === manufacturerId);
      if (!manufacturer) throw new MarketplaceError("Brand not found.");
      manufacturer.description = description.trim();
      manufacturer.website = website.trim();
    },
    async ownSupplier(supplierId) {
      return store.suppliers.find((row) => row.id === supplierId) ?? null;
    },
    async adminSuppliers() {
      return store.suppliers.slice();
    },
    async setSupplierStatus(supplierId, status: SupplierStatus) {
      const supplier = store.suppliers.find((row) => row.id === supplierId);
      if (!supplier) throw new MarketplaceError("Supplier not found.");
      supplier.status = status;
    },
    async manufacturers() {
      return store.manufacturers.slice();
    },
    async setAuthorisation(manufacturerId, supplierId, authorised) {
      const exists = store.authorisations.findIndex(
        (row) => row.manufacturerId === manufacturerId && row.supplierId === supplierId,
      );
      if (authorised && exists < 0) store.authorisations.push({ manufacturerId, supplierId });
      if (!authorised && exists >= 0) store.authorisations.splice(exists, 1);
    },
    async authorisations() {
      return store.authorisations.slice();
    },
    async adminRfqs() {
      return store.rfqs.map((rfq) => {
        const buyer = store.buyers.find((row) => row.id === rfq.buyerId);
        const lines = store.rfqLines.filter((row) => row.rfqId === rfq.id);
        const bids = store.bids.filter((bid) => lines.some((line) => line.id === bid.rfqLineId));
        return {
          id: rfq.id,
          title: rfq.title,
          status: rfq.status,
          buyerCompany: buyer?.company ?? "",
          createdAt: rfq.createdAt,
          lines: lines.length,
          bids: bids.length,
          routes: store.routes.filter((row) => row.rfqId === rfq.id).length,
        };
      });
    },
    async adminRfq(rfqId) {
      const rfq = store.rfqs.find((row) => row.id === rfqId);
      if (!rfq) return null;
      const buyer = store.buyers.find((row) => row.id === rfq.buyerId);
      const lines = store.rfqLines.filter((row) => row.rfqId === rfq.id);
      const lineIds = new Set(lines.map((row) => row.id));
      return {
        rfq,
        buyerCompany: buyer?.company ?? "",
        buyerCity: buyer?.city ?? "",
        lines: projectAdminLines({
          lines,
          bids: store.bids.filter((bid) => lineIds.has(bid.rfqLineId)),
          suppliers: store.suppliers,
        }),
        routedSupplierIds: store.routes.filter((row) => row.rfqId === rfq.id).map((row) => row.supplierId),
        suggestions: suggest(store, rfqId, clock()),
      };
    },
    async routeRfq(rfqId, supplierIds) {
      if (!store.rfqs.some((row) => row.id === rfqId)) throw new MarketplaceError("RFQ not found.");
      const now = clock().toISOString();
      for (const supplierId of supplierIds) {
        if (!store.suppliers.some((row) => row.id === supplierId && row.status === "verified")) continue;
        if (store.routes.some((row) => row.rfqId === rfqId && row.supplierId === supplierId)) continue;
        store.routes.push({ rfqId, supplierId, createdAt: now });
      }
    },
    async award(lineId, bidId) {
      const line = store.rfqLines.find((row) => row.id === lineId);
      if (!line) throw new MarketplaceError("Line not found.");
      const bid = store.bids.find((row) => row.id === bidId && row.rfqLineId === lineId && !row.cantSupply);
      if (!bid) throw new MarketplaceError("Choose a quote that offers supply.");
      line.awardedBidId = bid.id;
      const rfq = store.rfqs.find((row) => row.id === line.rfqId);
      if (!rfq) return;
      const lines = store.rfqLines.filter((row) => row.rfqId === rfq.id);
      if (lines.every((row) => row.awardedBidId)) {
        rfq.status = "awarded";
        rfq.awardedAt = clock().toISOString();
      }
    },
    async closeRfq(rfqId) {
      const rfq = store.rfqs.find((row) => row.id === rfqId);
      if (!rfq) throw new MarketplaceError("RFQ not found.");
      rfq.status = "closed";
    },
    async flags() {
      return store.flags.slice().sort((a, b) => Number(a.resolved) - Number(b.resolved));
    },
    async resolveFlag(flagId) {
      const flag = store.flags.find((row) => row.id === flagId);
      if (!flag) throw new MarketplaceError("Flag not found.");
      flag.resolved = true;
    },
    async signupSupplier(input) {
      const message = validateSupplierSignup(input);
      if (message) throw new MarketplaceError(message);
      const clean = normalizeSupplierSignup(input);
      if (store.users.some((row) => row.email === clean.email)) throw new MarketplaceError("That email is already registered.");
      if (store.suppliers.some((row) => row.gstin === clean.gstin)) throw new MarketplaceError("That GSTIN is already registered.");
      const now = clock().toISOString();
      const userId = id("user");
      const supplierId = id("sup");
      store.users.push({ id: userId, email: clean.email, role: "supplier", name: clean.contactPerson });
      store.suppliers.push({ id: supplierId, userId, ...clean, status: "pending" });
      const duplicateMobile = store.suppliers.filter((row) => row.mobile === clean.mobile).length > 1;
      if (duplicateMobile) {
        store.flags.push({
          id: id("flag"),
          entityType: "supplier",
          entityId: supplierId,
          reason: "Mobile number is already used by another supplier account.",
          createdAt: now,
          resolved: false,
        });
      }
      const session = sessionFrom(store, userId);
      if (!session) throw new MarketplaceError("Could not open the new account.");
      return session;
    },
    async signupBuyer(input) {
      const email = input.email.trim().toLowerCase();
      if (!input.name.trim() || !input.company.trim() || !input.city.trim()) {
        throw new MarketplaceError("Name, company, and city are required.");
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new MarketplaceError("Enter a valid email.");
      if (store.users.some((row) => row.email === email)) throw new MarketplaceError("That email is already registered.");
      const userId = id("user");
      store.users.push({ id: userId, email, role: "buyer", name: input.name.trim() });
      store.buyers.push({
        id: id("buy"),
        userId,
        name: input.name.trim(),
        company: input.company.trim(),
        email,
        city: input.city.trim(),
        mobile: input.mobile.trim(),
      });
      const session = sessionFrom(store, userId);
      if (!session) throw new MarketplaceError("Could not open the new account.");
      return session;
    },
    async signupManufacturer(input) {
      const email = input.email.trim().toLowerCase();
      if (input.brandName.trim().length < 2) throw new MarketplaceError("Enter the brand name.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new MarketplaceError("Enter a valid email.");
      if (store.users.some((row) => row.email === email)) throw new MarketplaceError("That email is already registered.");
      const slug = input.brandName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      if (store.manufacturers.some((row) => row.slug === slug)) throw new MarketplaceError("That brand name is already listed.");
      const userId = id("user");
      store.users.push({ id: userId, email, role: "manufacturer", name: input.contactName.trim() || input.brandName.trim() });
      store.manufacturers.push({
        id: id("mfr"),
        userId,
        brandName: input.brandName.trim(),
        slug,
        description: input.description.trim(),
        website: input.website.trim(),
      });
      const session = sessionFrom(store, userId);
      if (!session) throw new MarketplaceError("Could not open the new account.");
      return session;
    },
    async sessionForUser(userId) {
      return sessionFrom(store, userId);
    },
    async userByEmail(email) {
      return store.users.find((row) => row.email === email.trim().toLowerCase()) ?? null;
    },
    async saveAttachment(supplierId, file) {
      if (!file.base64) throw new MarketplaceError("The file was empty.");
      if (file.base64.length > 2_000_000) throw new MarketplaceError("Attachments are limited to about 1.5 MB.");
      const path = `${supplierId}/${crypto.randomUUID()}/${file.filename.replace(/[^\w.\-]+/g, "_")}`;
      store.attachments.push({
        path,
        filename: file.filename,
        contentType: file.contentType || "application/octet-stream",
        base64: file.base64,
      });
      return { path, name: file.filename };
    },
    async signedAttachmentUrl(session, path) {
      if (!canReadAttachment(store, session, path)) return null;
      const exp = Date.now() + 120_000;
      const token = signToken(`${path}|${exp}`);
      return `/api/files?token=${encodeURIComponent(token)}`;
    },
    async readDemoAttachment(path) {
      return store.attachments.find((row) => row.path === path) ?? null;
    },
  };
}

function canReadAttachment(store: Store, session: Session, path: string): boolean {
  const bid = store.bids.find((row) => row.attachmentPath === path);
  if (!bid) return false;
  if (session.role === "admin") return true;
  if (session.supplierId && bid.supplierId === session.supplierId) return true;
  if (!session.buyerId) return false;
  const line = store.rfqLines.find((row) => row.id === bid.rfqLineId);
  const rfq = line ? store.rfqs.find((row) => row.id === line.rfqId) : undefined;
  return rfq?.buyerId === session.buyerId;
}

function suggest(store: Store, rfqId: string, now: Date) {
  const lines = store.rfqLines.filter((row) => row.rfqId === rfqId);
  const wanted = new Set(lines.map((row) => normalizeMpn(row.mpn)).filter(Boolean));
  const suggestions: { supplierId: string; companyName: string; city: string; reason: string }[] = [];
  for (const supplier of store.suppliers.filter((row) => row.status === "verified")) {
    const hit = store.listings.find(
      (row) => row.supplierId === supplier.id && isFresh(row.lastUpdated, now) && wanted.has(row.mpnNorm),
    );
    if (hit) {
      suggestions.push({
        supplierId: supplier.id,
        companyName: supplier.companyName,
        city: supplier.city,
        reason: `Fresh stock of ${hit.mpn}`,
      });
    }
  }
  return suggestions;
}

export function countRecords(store: Store): number {
  return (
    store.listings.length +
    store.bids.length +
    store.rfqs.length +
    store.rfqLines.length +
    store.boms.length +
    store.bomRevisions.length +
    store.bomLines.length
  );
}

export function blankListing(): ListingInput {
  return {
    mpn: "",
    manufacturer: "",
    description: "",
    category: "",
    package: "",
    qty: 0,
    moq: 0,
    priceBreaks: [],
    gstMode: "extra",
    leadTime: "",
    dateCode: "",
    city: "",
    state: "",
  };
}

export function emptyRfqLine(): RfqDraftLine {
  return { mpn: "", manufacturer: "", description: "", qty: 0 };
}
