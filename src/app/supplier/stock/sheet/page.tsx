import { PortalFrame } from "@/components/portal-frame";
import { SheetSync } from "@/components/stock-tools";
import { requireRole } from "@/lib/auth/guard";
import { getRepo } from "@/lib/data";

export default async function SheetPage() {
  const session = await requireRole("supplier");
  const supplier = await (await getRepo()).ownSupplier(session.supplierId!);
  return (
    <PortalFrame role="supplier" title="Google Sheet">
      <SheetSync city={supplier?.city ?? ""} state={supplier?.state ?? ""} />
    </PortalFrame>
  );
}
