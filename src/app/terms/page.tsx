import { copy } from "@/lib/i18n";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <article className="prose mx-auto max-w-3xl px-4 py-12 text-ink">
      <h1 className="font-serif text-4xl">{copy.legal.termsTitle}</h1>
      <p className="mt-4 leading-7">
        {copy.operator} These terms cover the Phase 1 marketplace: public stock search, supplier listings, BOM matching, and sealed RFQs. They are a working policy for this product, not a substitute for counsel.
      </p>
      <h2 className="mt-8 font-serif text-2xl">Stock</h2>
      <p className="mt-2 leading-7">
        Suppliers publish their own quantities. Private price breaks are visible only to the supplier who entered them and to administrators. Listings that have not been updated for 14 days leave the default search.
      </p>
      <h2 className="mt-8 font-serif text-2xl">Sealed quotes</h2>
      <p className="mt-2 leading-7">
        A supplier can see only their own bid. The marketplace does not show another supplier&apos;s rate, identity, rank, or a running best price. Buyers see quote terms. The supplier name on a line is shown after that bid is awarded.
      </p>
      <h2 className="mt-8 font-serif text-2xl">Accounts</h2>
      <p className="mt-2 leading-7">
        Supplier registration asks for a company, contact, mobile, email, GSTIN, city, and state. Bids from a supplier account open after verification. Do not upload another company&apos;s confidential files.
      </p>
    </article>
  );
}
