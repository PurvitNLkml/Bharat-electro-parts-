import type { Role } from "@/lib/domain/types";
import Link from "next/link";
import type { ReactNode } from "react";

const NAV: Record<Role, [string, string][]> = {
  buyer: [
    ["/buyer", "Overview"],
    ["/buyer/boms", "BOMs"],
    ["/buyer/rfqs", "RFQs"],
    ["/buyer/rfqs/new", "New RFQ"],
    ["/search", "Search"],
  ],
  supplier: [
    ["/supplier", "Overview"],
    ["/supplier/stock", "Stock"],
    ["/supplier/stock/new", "Add part"],
    ["/supplier/stock/grid", "Grid entry"],
    ["/supplier/stock/upload", "Upload"],
    ["/supplier/stock/sheet", "Google Sheet"],
    ["/supplier/rfqs", "RFQ inbox"],
  ],
  manufacturer: [
    ["/manufacturer", "Brand"],
    ["/brands", "All brands"],
  ],
  admin: [
    ["/admin", "Overview"],
    ["/admin/suppliers", "Suppliers"],
    ["/admin/rfqs", "RFQs"],
    ["/admin/flags", "Fraud flags"],
  ],
};

export function PortalFrame({ role, title, children }: { role: Role; title: string; children: ReactNode }) {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 md:grid-cols-[210px_minmax(0,1fr)]">
      <nav className="flex gap-2 overflow-auto md:flex-col">
        {NAV[role].map(([href, label]) => (
          <Link key={href} href={href} className="whitespace-nowrap rounded-full border border-line bg-card px-3 py-2 text-sm font-semibold hover:border-copper">
            {label}
          </Link>
        ))}
      </nav>
      <section className="min-w-0">
        <h1 className="font-serif text-4xl text-ink">{title}</h1>
        <div className="mt-6">{children}</div>
      </section>
    </div>
  );
}
