import { DataView } from "@/components/data-view";
import { PortalFrame } from "@/components/portal-frame";
import { UploadWizard } from "@/components/stock-tools";
import { requireRole } from "@/lib/auth/guard";
import { getRepo } from "@/lib/data";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function BomDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ rev?: string; diff?: string }>;
}) {
  const session = await requireRole("buyer");
  const { id } = await params;
  const query = await searchParams;
  const detail = await (await getRepo()).bomDetail(session.buyerId!, id, query.rev, query.diff);
  if (!detail) notFound();
  const unmatched = detail.lines.filter((line) => line.match.type === "none");
  return (
    <PortalFrame role="buyer" title={detail.bom.name}>
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {detail.revisions.map((revision) => (
          <Link key={revision.id} href={`/buyer/boms/${id}?rev=${revision.id}${query.diff ? `&diff=${query.diff}` : ""}`} className="rounded-full border border-line bg-card px-3 py-1">
            {revision.label}
          </Link>
        ))}
      </div>
      <form className="mb-4 flex flex-wrap items-end gap-2 text-sm" action={`/buyer/boms/${id}`}>
        <input type="hidden" name="rev" value={detail.revision.id} />
        <label>
          Compare with
          <select className="ml-2 rounded-full border border-line bg-white px-3 py-2" name="diff" defaultValue={query.diff ?? ""}>
            <option value="">None</option>
            {detail.revisions.filter((revision) => revision.id !== detail.revision.id).map((revision) => (
              <option key={revision.id} value={revision.id}>{revision.label}</option>
            ))}
          </select>
        </label>
        <button className="rounded-full bg-ink px-3 py-2 text-white" type="submit">Show diff</button>
      </form>
      {detail.diff ? (
        <div className="mb-6 overflow-x-auto rounded-2xl border border-line">
          <table className="min-w-full text-left text-sm">
            <thead><tr><th className="px-3 py-2">Change</th><th className="px-3 py-2">MPN</th><th className="px-3 py-2">Earlier qty</th><th className="px-3 py-2">This qty</th></tr></thead>
            <tbody>
              {detail.diff.map((row) => (
                <tr key={row.mpn} className="border-t border-line">
                  <td className="px-3 py-2">{row.change}</td>
                  <td className="px-3 py-2 font-mono">{row.mpn}</td>
                  <td className="px-3 py-2">{row.qtyA ?? "—"}</td>
                  <td className="px-3 py-2">{row.qtyB ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <DataView
        screen={`bom-${id}`}
        columns={[
          { key: "line", title: "Line", kind: "number" },
          { key: "mpn", title: "MPN", width: 180 },
          { key: "manufacturer", title: "Manufacturer" },
          { key: "qty", title: "Qty", kind: "number" },
          { key: "refdes", title: "Refdes" },
          { key: "match", title: "Match" },
          { key: "alternate", title: "Alternate" },
        ]}
        rows={detail.lines.map((line) => ({
          line: line.lineNo,
          mpn: line.mpn,
          manufacturer: line.manufacturer,
          qty: line.qty,
          refdes: line.refdes,
          match: line.match.type === "none" ? "Unmatched" : `${line.match.type} ${line.match.listing?.mpn ?? ""} (${line.match.listing?.city ?? ""})`,
          alternate: line.match.alternates[0] ? `${line.match.alternates[0].listing.mpn} · ${line.match.alternates[0].listing.city}` : "",
        }))}
      />
      {unmatched.length > 0 ? (
        <Link className="mt-4 inline-flex rounded-full bg-copper px-4 py-2 text-sm font-semibold text-white" href={`/buyer/rfqs/new?bom=${id}&rev=${detail.revision.id}`}>
          Post RFQ for unmatched lines
        </Link>
      ) : null}
      <div className="mt-8">
        <h2 className="font-serif text-2xl">Add a revision</h2>
        <UploadWizard kind="bom" bomId={id} />
      </div>
    </PortalFrame>
  );
}
