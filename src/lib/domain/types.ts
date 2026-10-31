export const FRESHNESS_DAYS = 14;

export type Role = "buyer" | "supplier" | "manufacturer" | "admin";

export type GstMode = "inclusive" | "extra";

export type SupplierStatus = "pending" | "verified" | "rejected";

export type RfqStatus = "open" | "awarded" | "closed";

export type MatchType = "exact" | "fuzzy" | "none";

export type PriceBreak = {
  minQty: number;
  rate: number;
};

export type User = {
  id: string;
  email: string;
  role: Role;
  name: string;
};

export type Supplier = {
  id: string;
  userId: string;
  companyName: string;
  contactPerson: string;
  mobile: string;
  email: string;
  gstin: string;
  city: string;
  state: string;
  status: SupplierStatus;
};

export type Buyer = {
  id: string;
  userId: string;
  name: string;
  company: string;
  email: string;
  city: string;
  mobile: string;
};

export type Manufacturer = {
  id: string;
  userId: string;
  brandName: string;
  slug: string;
  description: string;
  website: string;
};

export type Authorisation = {
  manufacturerId: string;
  supplierId: string;
};

export type Listing = {
  id: string;
  supplierId: string;
  mpn: string;
  mpnNorm: string;
  manufacturer: string;
  description: string;
  category: string;
  package: string;
  qty: number;
  moq: number;
  priceBreaks: PriceBreak[];
  gstMode: GstMode;
  leadTime: string;
  dateCode: string;
  city: string;
  state: string;
  lastUpdated: string;
  createdAt: string;
};

export type PublicListing = {
  id: string;
  mpn: string;
  manufacturer: string;
  description: string;
  category: string;
  package: string;
  qty: number;
  moq: number;
  gstMode: GstMode;
  leadTime: string;
  dateCode: string;
  city: string;
  state: string;
  lastUpdated: string;
  inStock: boolean;
};

export type Bom = {
  id: string;
  buyerId: string;
  name: string;
  createdAt: string;
};

export type BomRevision = {
  id: string;
  bomId: string;
  label: string;
  note: string;
  createdAt: string;
};

export type BomLine = {
  id: string;
  revisionId: string;
  lineNo: number;
  mpn: string;
  manufacturer: string;
  description: string;
  qty: number;
  refdes: string;
  package: string;
};

export type Rfq = {
  id: string;
  buyerId: string;
  title: string;
  status: RfqStatus;
  notes: string;
  createdAt: string;
  awardedAt: string | null;
};

export type RfqLine = {
  id: string;
  rfqId: string;
  lineNo: number;
  mpn: string;
  manufacturer: string;
  description: string;
  qty: number;
  awardedBidId: string | null;
};

export type RfqRoute = {
  rfqId: string;
  supplierId: string;
  createdAt: string;
};

export type Bid = {
  id: string;
  rfqLineId: string;
  supplierId: string;
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

export type FraudFlag = {
  id: string;
  entityType: "supplier" | "listing" | "bid" | "buyer";
  entityId: string;
  reason: string;
  createdAt: string;
  resolved: boolean;
};

export type Attachment = {
  path: string;
  filename: string;
  contentType: string;
  base64: string;
};

export type Store = {
  users: User[];
  suppliers: Supplier[];
  buyers: Buyer[];
  manufacturers: Manufacturer[];
  authorisations: Authorisation[];
  listings: Listing[];
  boms: Bom[];
  bomRevisions: BomRevision[];
  bomLines: BomLine[];
  rfqs: Rfq[];
  rfqLines: RfqLine[];
  routes: RfqRoute[];
  bids: Bid[];
  flags: FraudFlag[];
  attachments: Attachment[];
};

export type Session = {
  userId: string;
  email: string;
  role: Role;
  name: string;
  supplierId: string | null;
  buyerId: string | null;
  manufacturerId: string | null;
};

export type ListingInput = {
  mpn: string;
  manufacturer: string;
  description?: string;
  category: string;
  package?: string;
  qty: number;
  moq: number;
  priceBreaks?: PriceBreak[];
  gstMode: GstMode;
  leadTime?: string;
  dateCode?: string;
  city: string;
  state: string;
};

export type RowFailure = { row: number; reason: string };

export type RowReport = {
  ok: number;
  failed: RowFailure[];
  createdIds: string[];
};

export type SearchParams = {
  q?: string;
  category?: string;
  city?: string;
  inStock?: boolean;
  includeStale?: boolean;
};

export type BidInput = {
  rfqLineId: string;
  rate: number | null;
  moq: number | null;
  stock: number | null;
  leadTime: string;
  brand: string;
  alternatePart: string;
  dateCode: string;
  validity: string;
  remarks: string;
  cantSupply: boolean;
  attachmentPath: string | null;
  attachmentName: string | null;
};

export type RfqDraftLine = {
  mpn: string;
  manufacturer?: string;
  description?: string;
  qty: number;
};

export type SupplierSignup = {
  companyName: string;
  contactPerson: string;
  mobile: string;
  email: string;
  gstin: string;
  city: string;
  state: string;
};

export type BuyerSignup = {
  name: string;
  company: string;
  email: string;
  city: string;
  mobile: string;
};

export type ManufacturerSignup = {
  brandName: string;
  contactName: string;
  email: string;
  website: string;
  description: string;
  city: string;
};
