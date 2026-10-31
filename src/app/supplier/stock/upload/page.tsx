import { PortalFrame } from "@/components/portal-frame";
import { UploadWizard } from "@/components/stock-tools";
import { requireRole } from "@/lib/auth/guard";
import { getRepo } from "@/lib/data";

export default async function UploadPage() {
  const session = await requireRole("supplier");
  const supplier = await (await getRepo()).ownSupplier(session.supplierId!);
  return (
    <PortalFrame role="supplier" title="Upload Excel or CSV">
      <UploadWizard kind="stock" city={supplier?.city ?? ""} state={supplier?.state ?? ""} />
    </PortalFrame>
  );
}
