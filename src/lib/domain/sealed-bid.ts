import type { Bid, Buyer, Rfq, RfqLine, Supplier } from "./types";

export type OwnBidView = {
  id: string;
  rate: number | null;
  moq: number | null;
  stock: number | null;
  leadTime: string;
  brand: string;
  alternatePart: string;
  dateCode: string;
  validity: string;
  remarks: string;
  attachmentPath: string | null;
  attachmentName: string | null;
  cantSupply: boolean;
  submittedAt: string;
};

export type SupplierLineView = {
  lineId: string;
  lineNo: number;
  mpn: string;
  manufacturer: string;
  description: string;
  qty: number;
  awarded: boolean;
  yourBid: OwnBidView | null;
};

export type SupplierRfqView = {
  id: string;
  title: string;
  status: Rfq["status"];
  buyerCompany: string;
  buyerCity: string;
  createdAt: string;
  notes: string;
  lines: SupplierLineView[];
};

export type RevealedSupplier =
  | { revealed: false }
  | {
      revealed: true;
      companyName: string;
      city: string;
      email: string;
      mobile: string;
    };

export type BuyerBidView = OwnBidView & {
  supplier: RevealedSupplier;
};

export type BuyerLineView = {
  lineId: string;
  lineNo: number;
  mpn: string;
  manufacturer: string;
  description: string;
  qty: number;
  awardedBidId: string | null;
  bids: BuyerBidView[];
};

export type BuyerRfqView = {
  id: string;
  title: string;
  status: Rfq["status"];
  notes: string;
  createdAt: string;
  lines: BuyerLineView[];
};

export type AdminBidView = OwnBidView & {
  supplierId: string;
  supplierCompany: string;
  supplierCity: string;
  supplierEmail: string;
  supplierStatus: Supplier["status"];
};

export type AdminLineView = {
  lineId: string;
  lineNo: number;
  mpn: string;
  manufacturer: string;
  description: string;
  qty: number;
  awardedBidId: string | null;
  bids: AdminBidView[];
};

function ownBid(bid: Bid): OwnBidView {
  return {
    id: bid.id,
    rate: bid.rate,
    moq: bid.moq,
    stock: bid.stock,
    leadTime: bid.leadTime,
    brand: bid.brand,
    alternatePart: bid.alternatePart,
    dateCode: bid.dateCode,
    validity: bid.validity,
    remarks: bid.remarks,
    attachmentPath: bid.attachmentPath,
    attachmentName: bid.attachmentName,
    cantSupply: bid.cantSupply,
    submittedAt: bid.submittedAt,
  };
}

/**
 * Supplier inbox. `bids` may contain every supplier's quotes. The result keeps
 * only this supplier's own bid. It has no rank, no competing rate, and no other
 * supplier's name.
 */
export function projectSupplierRfq(input: {
  supplierId: string;
  rfq: Rfq;
  buyer: Pick<Buyer, "company" | "city">;
  lines: RfqLine[];
  bids: Bid[];
}): SupplierRfqView {
  const lines = input.lines
    .filter((line) => line.rfqId === input.rfq.id)
    .sort((a, b) => a.lineNo - b.lineNo)
    .map((line) => {
      const mine = input.bids.find((bid) => bid.rfqLineId === line.id && bid.supplierId === input.supplierId) ?? null;
      return {
        lineId: line.id,
        lineNo: line.lineNo,
        mpn: line.mpn,
        manufacturer: line.manufacturer,
        description: line.description,
        qty: line.qty,
        awarded: line.awardedBidId !== null,
        yourBid: mine ? ownBid(mine) : null,
      };
    });

  return {
    id: input.rfq.id,
    title: input.rfq.title,
    status: input.rfq.status,
    buyerCompany: input.buyer.company,
    buyerCity: input.buyer.city,
    createdAt: input.rfq.createdAt,
    notes: input.rfq.notes,
    lines,
  };
}

/**
 * Buyer quotes. Commercial terms are visible. The supplier name is included
 * only on the bid that was awarded for that line.
 */
export function projectBuyerRfq(input: {
  buyerId: string;
  rfq: Rfq;
  lines: RfqLine[];
  bids: Bid[];
  suppliers: Supplier[];
}): BuyerRfqView | null {
  if (input.rfq.buyerId !== input.buyerId) return null;
  const lines = input.lines
    .filter((line) => line.rfqId === input.rfq.id)
    .sort((a, b) => a.lineNo - b.lineNo)
    .map((line) => ({
      lineId: line.id,
      lineNo: line.lineNo,
      mpn: line.mpn,
      manufacturer: line.manufacturer,
      description: line.description,
      qty: line.qty,
      awardedBidId: line.awardedBidId,
      bids: input.bids
        .filter((bid) => bid.rfqLineId === line.id)
        .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
        .map((bid) => {
          const awarded = line.awardedBidId === bid.id;
          const supplier = input.suppliers.find((row) => row.id === bid.supplierId);
          const view: BuyerBidView = {
            ...ownBid(bid),
            supplier: awarded && supplier
              ? {
                  revealed: true,
                  companyName: supplier.companyName,
                  city: supplier.city,
                  email: supplier.email,
                  mobile: supplier.mobile,
                }
              : { revealed: false },
          };
          return view;
        }),
    }));

  return {
    id: input.rfq.id,
    title: input.rfq.title,
    status: input.rfq.status,
    notes: input.rfq.notes,
    createdAt: input.rfq.createdAt,
    lines,
  };
}

export function projectAdminLines(input: {
  lines: RfqLine[];
  bids: Bid[];
  suppliers: Supplier[];
}): AdminLineView[] {
  return input.lines
    .slice()
    .sort((a, b) => a.lineNo - b.lineNo)
    .map((line) => ({
      lineId: line.id,
      lineNo: line.lineNo,
      mpn: line.mpn,
      manufacturer: line.manufacturer,
      description: line.description,
      qty: line.qty,
      awardedBidId: line.awardedBidId,
      bids: input.bids
        .filter((bid) => bid.rfqLineId === line.id)
        .map((bid) => {
          const supplier = input.suppliers.find((row) => row.id === bid.supplierId);
          return {
            ...ownBid(bid),
            supplierId: bid.supplierId,
            supplierCompany: supplier?.companyName ?? "Unknown supplier",
            supplierCity: supplier?.city ?? "",
            supplierEmail: supplier?.email ?? "",
            supplierStatus: supplier?.status ?? "pending",
          };
        }),
    }));
}

const BANNED_KEYS = new Set([
  "lowest",
  "lowestrate",
  "rank",
  "ranking",
  "competing",
  "competingbids",
  "otherbids",
  "bidcount",
  "suppliercount",
  "bestprice",
  "minrate",
]);

export function findBannedKeys(value: unknown): string[] {
  const found: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      if (BANNED_KEYS.has(key.toLowerCase())) found.push(key);
      walk(child);
    }
  };
  walk(value);
  return found;
}
