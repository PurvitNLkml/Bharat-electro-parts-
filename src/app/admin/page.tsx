import { PortalFrame } from "@/components/portal-frame";
import { requireRole } from "@/lib/auth/guard";
import { getRepo } from "@/lib/data";
import Link from "next/link";

export default async function AdminHome() {
  const awaitRole = await requireRole("admin");
  void awaitRole;
  const repo = await getRepo();
  const [suppliers, rfqs, flags] = await Promise.all([repo.adminSuppliers(), repo.adminRfqs(), repo.flags()]);
  return (
    <PortalFrame role="admin" title="Console">
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/admin/suppliers" className="rounded-3xl border border-line bg-card p-5">
          <h2 className="font-serif text-2xl">Suppliers</h2>
          <p className="mt-2 text-sm">{suppliers.filter((row) => row.status === "pending").length} pending</p>
        </Link>
        <Link href="/admin/rfqs" className="rounded-3xl border border-line bg-card p-5">
          <h2 className="font-serif text-2xl">RFQs</h2>
          <p className="mt-2 text-sm">{rfqs.length} requests</p>
        </Link>
        <Link href="/admin/flags" className="rounded-3xl border border-line bg-card p-5">
          <h2 className="font-serif text-2xl">Flags</h2>
          <p className="mt-2 text-sm">{flags.filter((row) => !row.resolved).length} open</p>
        </Link>
      </div>
    </PortalFrame>
  );
}
