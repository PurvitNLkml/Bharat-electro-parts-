import { describe, expect, it } from "vitest";
import { createDemoRepo } from "@/lib/data/demo-repo";
import { createSeedStore } from "@/lib/demo/seed";
import { findBannedKeys, projectBuyerRfq, projectSupplierRfq } from "./sealed-bid";

const NOW = new Date("2026-10-31T00:00:00Z");

function fixture() {
  const store = createSeedStore(NOW);
  return { store, repo: createDemoRepo(store, () => NOW) };
}

describe("sealed bids", () => {
  it("hides every other supplier's rate, identity, rank, and bid count from a supplier", async () => {
    const { store, repo } = fixture();
    const view = await repo.supplierRfq("sup_mehta", "rfq_connector");
    expect(view).not.toBeNull();
    const json = JSON.stringify(view);
    expect(json).toContain("17.35");
    expect(json).not.toContain("41.8");
    expect(json).not.toContain("6.25");
    expect(json).not.toContain("Pune Circuit House");
    expect(json).not.toContain("Noida Semiconductor Desk");
    expect(json).not.toContain("sup_pune");
    expect(findBannedKeys(view)).toEqual([]);
    expect(view?.lines[0]?.yourBid?.rate).toBe(17.35);
    expect(view?.lines[1]?.yourBid).toBeNull();

    const hostile = projectSupplierRfq({
      supplierId: "sup_mehta",
      rfq: store.rfqs[0]!,
      buyer: { company: "Rivergate Systems", city: "Bengaluru" },
      lines: store.rfqLines,
      bids: store.bids,
    });
    expect(JSON.stringify(hostile)).not.toContain("41.8");
    expect(findBannedKeys(hostile)).toEqual([]);
    expect(hostile.lines.every((line) => line.yourBid === null || line.yourBid.id.startsWith("bid_mehta"))).toBe(true);
  });

  it("shows quote terms to the buyer and the supplier name only on the awarded bid", async () => {
    const { repo } = fixture();
    const open = await repo.buyerRfq("buy_asha", "rfq_connector");
    const openJson = JSON.stringify(open);
    expect(openJson).toContain("17.35");
    expect(openJson).toContain("41.8");
    expect(openJson).toContain("6.25");
    expect(openJson).not.toContain("Mehta Components");
    expect(openJson).not.toContain("Pune Circuit House");
    expect(openJson).not.toContain("Noida Semiconductor Desk");
    expect(openJson).not.toContain("sup_mehta");
    expect(open?.lines[0]?.bids.every((bid) => bid.supplier.revealed === false)).toBe(true);

    const awarded = await repo.buyerRfq("buy_asha", "rfq_sensor");
    const winning = awarded?.lines[0]?.bids.find((bid) => bid.id === "bid_mehta_bme");
    const losing = awarded?.lines[0]?.bids.find((bid) => bid.id === "bid_pune_bme");
    expect(winning?.supplier).toMatchObject({ revealed: true, companyName: "Mehta Components" });
    expect(losing?.supplier).toEqual({ revealed: false });
    expect(JSON.stringify(losing)).not.toContain("Pune Circuit House");
    expect(JSON.stringify(losing)).not.toContain("sup_pune");
  });

  it("does not let another buyer or an unrouted supplier open the RFQ", async () => {
    const { repo } = fixture();
    expect(await repo.buyerRfq("buy_rohan", "rfq_connector")).toBeNull();
    expect(await repo.supplierRfq("sup_kochi", "rfq_connector")).toBeNull();
  });

  it("shows every bidder to an admin view and still withholds that view from the supplier projector", async () => {
    const { repo } = fixture();
    const admin = await repo.adminRfq("rfq_connector");
    const names = admin?.lines[0]?.bids.map((bid) => bid.supplierCompany).sort();
    expect(names).toEqual(["Mehta Components", "Noida Semiconductor Desk", "Pune Circuit House"]);
    expect(admin?.lines[0]?.bids.map((bid) => bid.rate).sort()).toEqual([17.35, 41.8, null]);
  });

  it("does not create a bid, listing, RFQ, or BOM until the payload is a real submission", async () => {
    const { store, repo } = fixture();
    const before = {
      bids: store.bids.length,
      listings: store.listings.length,
      rfqs: store.rfqs.length,
      boms: store.boms.length,
    };
    const report = await repo.addListings("sup_mehta", [
      {
        mpn: "",
        manufacturer: "",
        category: "",
        qty: 0,
        moq: 0,
        gstMode: "extra",
        city: "",
        state: "",
      },
    ]);
    expect(report.ok).toBe(0);
    expect(report.createdIds).toEqual([]);
    await expect(repo.createRfq("buy_asha", "Empty", "", [{ mpn: "", qty: 0 }])).rejects.toThrow(/at least one line/);
    await expect(repo.createBom("buy_asha", "Blank", [{ mpn: "", qty: 0 }], "")).rejects.toThrow(/at least one BOM line/);
    await expect(
      repo.submitBid("sup_mehta", {
        rfqLineId: "rfl_conn_2",
        rate: null,
        moq: null,
        stock: null,
        leadTime: "",
        brand: "",
        alternatePart: "",
        dateCode: "",
        validity: "",
        remarks: "",
        cantSupply: false,
        attachmentPath: null,
        attachmentName: null,
      }),
    ).rejects.toThrow(/rate/);
    expect(store.bids).toHaveLength(before.bids);
    expect(store.listings).toHaveLength(before.listings);
    expect(store.rfqs).toHaveLength(before.rfqs);
    expect(store.boms).toHaveLength(before.boms);
  });

  it("refuses a pending supplier's bid", async () => {
    const { store, repo } = fixture();
    store.routes.push({ rfqId: "rfq_connector", supplierId: "sup_kochi", createdAt: NOW.toISOString() });
    await expect(
      repo.submitBid("sup_kochi", {
        rfqLineId: "rfl_conn_2",
        rate: 10,
        moq: 1,
        stock: 1,
        leadTime: "Ready stock",
        brand: "Toshiba",
        alternatePart: "",
        dateCode: "2510",
        validity: "2026-11-30",
        remarks: "",
        cantSupply: false,
        attachmentPath: null,
        attachmentName: null,
      }),
    ).rejects.toThrow(/verifies/);
  });
});

describe("buyer projector ignores a mismatched buyer id", () => {
  it("returns null when the RFQ belongs to someone else", () => {
    const store = createSeedStore(NOW);
    const rfq = store.rfqs[0]!;
    expect(
      projectBuyerRfq({
        buyerId: "buy_rohan",
        rfq,
        lines: store.rfqLines,
        bids: store.bids,
        suppliers: store.suppliers,
      }),
    ).toBeNull();
  });
});
