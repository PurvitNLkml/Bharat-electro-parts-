import { DataView } from "@/components/data-view";
import { PortalFrame } from "@/components/portal-frame";
import { requireRole } from "@/lib/auth/guard";
import { getRepo } from "@/lib/data";
import { isFresh } from "@/lib/domain/freshness";
import { formatInr, formatWhen, gstLabel } from "@/lib/format";
import { copy } from "@/lib/i18n";

export default async function StockPage() {
  const session = await requireRole("supplier");
  const listings = await (await getRepo()).listingsForSupplier(session.supplierId!);
  const now = new Date();
  return (
    <PortalFrame role="supplier" title={copy.supplier.stock}>
      <p className="mb-4 text-sm text-ink-soft">{copy.home.step1Body} {copy.supplier.private} stay on this account.</p>
      <DataView
        screen="supplier-stock"
        columns={[
          { key: "mpn", title: "MPN", width: 170 },
          { key: "manufacturer", title: "Manufacturer", width: 160 },
          { key: "qty", title: "Qty", kind: "number" },
          { key: "moq", title: "MOQ", kind: "number" },
          { key: "breaks", title: "Price breaks", width: 180 },
          { key: "gst", title: "GST" },
          { key: "city", title: "City" },
          { key: "updated", title: "Updated" },
          { key: "fresh", title: "In default search" },
        ]}
        rows={listings.map((row) => ({
          id: row.id,
          mpn: row.mpn,
          manufacturer: row.manufacturer,
          qty: row.qty,
          moq: row.moq,
          breaks: row.priceBreaks.map((brk) => `${brk.minQty} @ ${formatInr(brk.rate)}`).join("; "),
          gst: gstLabel(row.gstMode),
          city: row.city,
          updated: formatWhen(row.lastUpdated),
          fresh: isFresh(row.lastUpdated, now) ? "Yes" : "No",
        }))}
        rowAction="touch"
      />
    </PortalFrame>
  );
}
