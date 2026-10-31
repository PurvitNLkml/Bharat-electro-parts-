import { DataView } from "@/components/data-view";
import { PortalFrame } from "@/components/portal-frame";
import { requireRole } from "@/lib/auth/guard";
import { getRepo } from "@/lib/data";
import { formatWhen } from "@/lib/format";
import { copy } from "@/lib/i18n";

export default async function SupplierInboxPage() {
  const session = await requireRole("supplier");
  const inbox = await (await getRepo()).inbox(session.supplierId!);
  return (
    <PortalFrame role="supplier" title={copy.supplier.inbox}>
      <p className="mb-4 text-sm text-ink-soft">{copy.supplier.sealed}</p>
      <DataView
        screen="supplier-inbox"
        columns={[
          { key: "title", title: "RFQ", width: 220 },
          { key: "buyer", title: "Buyer" },
          { key: "city", title: "City" },
          { key: "status", title: "Status" },
          { key: "lines", title: "Lines", kind: "number" },
          { key: "yours", title: "Your bids", kind: "number" },
          { key: "created", title: "Routed" },
        ]}
        rows={inbox.map((row) => ({
          id: row.id,
          title: row.title,
          buyer: row.buyerCompany,
          city: row.buyerCity,
          status: row.status,
          lines: row.lines,
          yours: row.yourBids,
          created: formatWhen(row.createdAt),
        }))}
        rowAction={{ open: "/supplier/rfqs/" }}
      />
    </PortalFrame>
  );
}
