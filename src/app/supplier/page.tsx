import { PortalFrame } from "@/components/portal-frame";
import { Pill } from "@/components/ui";
import { requireRole } from "@/lib/auth/guard";
import { getRepo } from "@/lib/data";
import Link from "next/link";

export default async function SupplierHome() {
  const session = await requireRole("supplier");
  const repo = await getRepo();
  const profile = await repo.ownSupplier(session.supplierId!);
  const listings = await repo.listingsForSupplier(session.supplierId!);
  const inbox = await repo.inbox(session.supplierId!);
  return (
    <PortalFrame role="supplier" title={profile?.companyName ?? session.name}>
      {profile ? <Pill tone={profile.status === "verified" ? "good" : "warn"}>{profile.status}</Pill> : null}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Link href="/supplier/stock" className="rounded-3xl border border-line bg-card p-5">
          <h2 className="font-serif text-2xl">Stock lines</h2>
          <p className="mt-2 text-sm text-ink-soft">{listings.length} lines, including ones outside the 14-day search window</p>
        </Link>
        <Link href="/supplier/rfqs" className="rounded-3xl border border-line bg-card p-5">
          <h2 className="font-serif text-2xl">RFQ inbox</h2>
          <p className="mt-2 text-sm text-ink-soft">{inbox.length} routed requests</p>
        </Link>
      </div>
    </PortalFrame>
  );
}
