import { PortalFrame } from "@/components/portal-frame";
import { requireRole } from "@/lib/auth/guard";
import { getRepo } from "@/lib/data";
import Link from "next/link";

export default async function BuyerHome() {
  const session = await requireRole("buyer");
  const repo = await getRepo();
  const [boms, rfqs] = await Promise.all([repo.bomsForBuyer(session.buyerId!), repo.rfqsForBuyer(session.buyerId!)]);
  return (
    <PortalFrame role="buyer" title={`Hello, ${session.name}`}>
      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/buyer/boms" className="rounded-3xl border border-line bg-card p-5">
          <h2 className="font-serif text-2xl">BOMs</h2>
          <p className="mt-2 text-sm text-ink-soft">{boms.length} boards on this account</p>
        </Link>
        <Link href="/buyer/rfqs" className="rounded-3xl border border-line bg-card p-5">
          <h2 className="font-serif text-2xl">RFQs</h2>
          <p className="mt-2 text-sm text-ink-soft">{rfqs.length} quote requests</p>
        </Link>
      </div>
    </PortalFrame>
  );
}
