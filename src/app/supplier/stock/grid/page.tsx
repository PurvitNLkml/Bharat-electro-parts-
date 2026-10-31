import { PortalFrame } from "@/components/portal-frame";
import { StockGrid } from "@/components/stock-tools";
import { requireRole } from "@/lib/auth/guard";
import { getRepo } from "@/lib/data";

export default async function StockGridPage() {
  const session = await requireRole("supplier");
  const supplier = await (await getRepo()).ownSupplier(session.supplierId!);
  return (
    <PortalFrame role="supplier" title="Grid entry">
      <StockGrid city={supplier?.city ?? ""} state={supplier?.state ?? ""} />
    </PortalFrame>
  );
}
