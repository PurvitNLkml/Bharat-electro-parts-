import { PortalFrame } from "@/components/portal-frame";
import { UploadWizard } from "@/components/stock-tools";
import { requireRole } from "@/lib/auth/guard";
import { getRepo } from "@/lib/data";
import { formatWhen } from "@/lib/format";
import Link from "next/link";

export default async function BomsPage() {
  const session = await requireRole("buyer");
  const boms = await (await getRepo()).bomsForBuyer(session.buyerId!);
  return (
    <PortalFrame role="buyer" title="BOMs">
      <div className="space-y-3">
        {boms.map((bom) => (
          <Link key={bom.id} href={`/buyer/boms/${bom.id}`} className="block rounded-2xl border border-line bg-card p-4">
            <span className="font-semibold">{bom.name}</span>
            <span className="ml-3 text-sm text-ink-soft">{bom.latest} · {bom.revisions} revisions · {formatWhen(bom.createdAt)}</span>
          </Link>
        ))}
        {boms.length === 0 ? <p className="text-ink-soft">No BOMs yet. Upload one below. A row is created only when you submit.</p> : null}
      </div>
      <div className="mt-8">
        <h2 className="font-serif text-2xl">Upload a BOM</h2>
        <div className="mt-3">
          <UploadWizard kind="bom" />
        </div>
      </div>
    </PortalFrame>
  );
}
