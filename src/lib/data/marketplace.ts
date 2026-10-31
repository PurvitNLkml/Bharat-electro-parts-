import type { DiffRow, LineMatch } from "@/lib/domain/bom-match";
import type { AdminLineView, BuyerRfqView, SupplierRfqView } from "@/lib/domain/sealed-bid";
import type {
  Attachment,
  BidInput,
  Bom,
  BomLine,
  BomRevision,
  BuyerSignup,
  FraudFlag,
  Listing,
  ListingInput,
  Manufacturer,
  ManufacturerSignup,
  PublicListing,
  Rfq,
  RfqDraftLine,
  RfqStatus,
  RowReport,
  SearchParams,
  Session,
  Supplier,
  SupplierSignup,
  SupplierStatus,
  User,
} from "@/lib/domain/types";

export type CategoryCount = { slug: string; name: string; count: number };

export type PartPage = {
  mpn: string;
  manufacturer: string;
  description: string;
  category: string;
  listings: PublicListing[];
};

export type BomSummary = {
  id: string;
  name: string;
  createdAt: string;
  revisions: number;
  latest: string;
};

export type BomDetail = {
  bom: Bom;
  revisions: BomRevision[];
  revision: BomRevision;
  lines: (BomLine & { match: LineMatch })[];
  diffAgainst: BomRevision | null;
  diff: DiffRow[] | null;
};

export type BuyerRfqSummary = {
  id: string;
  title: string;
  status: RfqStatus;
  createdAt: string;
  lines: number;
  quotes: number;
};

export type SupplierInboxItem = {
  id: string;
  title: string;
  status: RfqStatus;
  buyerCompany: string;
  buyerCity: string;
  createdAt: string;
  lines: number;
  yourBids: number;
};

export type BrandStockist = {
  supplierId: string;
  companyName: string;
  city: string;
  state: string;
  parts: { mpn: string; qty: number; city: string; package: string }[];
};

export type BrandPage = {
  manufacturer: Manufacturer;
  parts: PublicListing[];
  stockists: BrandStockist[];
};

export type AdminRfqSummary = {
  id: string;
  title: string;
  status: RfqStatus;
  buyerCompany: string;
  createdAt: string;
  lines: number;
  bids: number;
  routes: number;
};

export type RouteSuggestion = {
  supplierId: string;
  companyName: string;
  city: string;
  reason: string;
};

export type AdminRfqDetail = {
  rfq: Rfq;
  buyerCompany: string;
  buyerCity: string;
  lines: AdminLineView[];
  routedSupplierIds: string[];
  suggestions: RouteSuggestion[];
};

export class MarketplaceError extends Error {}

export type BomLineInput = {
  mpn: string;
  manufacturer?: string;
  description?: string;
  qty: number;
  refdes?: string;
  package?: string;
};

export interface Marketplace {
  search(params: SearchParams): Promise<PublicListing[]>;
  cities(): Promise<string[]>;
  categoryCounts(): Promise<CategoryCount[]>;
  part(mpn: string): Promise<PartPage | null>;
  listingsForSupplier(supplierId: string): Promise<Listing[]>;
  addListings(supplierId: string, rows: ListingInput[]): Promise<RowReport>;
  touchListing(supplierId: string, listingId: string): Promise<void>;
  bomsForBuyer(buyerId: string): Promise<BomSummary[]>;
  bomDetail(buyerId: string, bomId: string, revisionId?: string, diffRevisionId?: string): Promise<BomDetail | null>;
  createBom(buyerId: string, name: string, lines: BomLineInput[], note: string): Promise<string>;
  addRevision(buyerId: string, bomId: string, lines: BomLineInput[], note: string): Promise<string>;
  rfqsForBuyer(buyerId: string): Promise<BuyerRfqSummary[]>;
  buyerRfq(buyerId: string, rfqId: string): Promise<BuyerRfqView | null>;
  createRfq(buyerId: string, title: string, notes: string, lines: RfqDraftLine[]): Promise<string>;
  inbox(supplierId: string): Promise<SupplierInboxItem[]>;
  supplierRfq(supplierId: string, rfqId: string): Promise<SupplierRfqView | null>;
  submitBid(supplierId: string, input: BidInput): Promise<void>;
  brands(): Promise<{ slug: string; brandName: string; description: string }[]>;
  brand(slug: string): Promise<BrandPage | null>;
  manufacturerHome(manufacturerId: string): Promise<BrandPage | null>;
  updateManufacturer(manufacturerId: string, description: string, website: string): Promise<void>;
  ownSupplier(supplierId: string): Promise<Supplier | null>;
  adminSuppliers(): Promise<Supplier[]>;
  setSupplierStatus(supplierId: string, status: SupplierStatus): Promise<void>;
  manufacturers(): Promise<Manufacturer[]>;
  setAuthorisation(manufacturerId: string, supplierId: string, authorised: boolean): Promise<void>;
  authorisations(): Promise<{ manufacturerId: string; supplierId: string }[]>;
  adminRfqs(): Promise<AdminRfqSummary[]>;
  adminRfq(rfqId: string): Promise<AdminRfqDetail | null>;
  routeRfq(rfqId: string, supplierIds: string[]): Promise<void>;
  award(lineId: string, bidId: string): Promise<void>;
  closeRfq(rfqId: string): Promise<void>;
  flags(): Promise<FraudFlag[]>;
  resolveFlag(flagId: string): Promise<void>;
  signupSupplier(input: SupplierSignup): Promise<Session>;
  signupBuyer(input: BuyerSignup): Promise<Session>;
  signupManufacturer(input: ManufacturerSignup): Promise<Session>;
  sessionForUser(userId: string): Promise<Session | null>;
  userByEmail(email: string): Promise<User | null>;
  saveAttachment(supplierId: string, file: { filename: string; contentType: string; base64: string }): Promise<{ path: string; name: string }>;
  signedAttachmentUrl(session: Session, path: string): Promise<string | null>;
  readDemoAttachment(path: string): Promise<Attachment | null>;
}
