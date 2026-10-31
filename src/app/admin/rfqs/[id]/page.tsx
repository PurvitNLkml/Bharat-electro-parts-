import { PortalFrame } from "@/components/portal-frame";
import { primaryBtn } from "@/components/ui";
import { requireRole } from "@/lib/auth/guard";
import { getRepo } from "@/lib/data";
import { formatInr } from "@/lib/format";
import { awardBid, routeSuggested } from "@/server/actions";
import { notFound } from "next/navigation";

export default async function AdminRfqPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await params;
  const detail = await (await getRepo()).adminRfq(id);
  if (!detail) notFound();
  return (
    <PortalFrame role="admin" title={detail.rfq.title}>
      <p className="text-sm text-ink-soft">{detail.buyerCompany}, {detail.buyerCity} · {detail.rfq.status}</p>
      <form action={routeSuggested} className="mt-4 rounded-2xl border border-line bg-card p-4">
        <input type="hidden" name="rfqId" value={detail.rfq.id} />
        <h2 className="font-semibold">Suggested suppliers</h2>
        <div className="mt-2 space-y-2">
          {detail.suggestions.length === 0 ? <p className="text-sm text-ink-soft">No fresh stock matches these lines.</p> : null}
          {detail.suggestions.map((suggestion) => (
            <label key={suggestion.supplierId} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="supplierId" value={suggestion.supplierId} defaultChecked={!detail.routedSupplierIds.includes(suggestion.supplierId)} />
              {suggestion.companyName} · {suggestion.city} · {suggestion.reason}
            </label>
          ))}
        </div>
        <button className={`${primaryBtn} mt-3`} type="submit">Route selected</button>
      </form>
      <div className="mt-6 space-y-4">
        {detail.lines.map((line) => (
          <section key={line.lineId} className="rounded-2xl border border-line bg-card p-4">
            <h2 className="font-mono">{line.mpn}</h2>
            <p className="text-sm text-ink-soft">Qty {line.qty}</p>
            <ul className="mt-3 space-y-2">
              {line.bids.map((bid) => (
                <li key={bid.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2 text-sm">
                  <span>
                    {bid.supplierCompany} · {bid.cantSupply ? "Can't supply" : formatInr(bid.rate ?? 0)} · MOQ {bid.moq ?? "—"} · {bid.leadTime}
                    {line.awardedBidId === bid.id ? " · awarded" : ""}
                  </span>
                  {!bid.cantSupply && line.awardedBidId !== bid.id ? (
                    <form action={awardBid}>
                      <input type="hidden" name="rfqId" value={detail.rfq.id} />
                      <input type="hidden" name="lineId" value={line.lineId} />
                      <input type="hidden" name="bidId" value={bid.id} />
                      <button className="font-semibold text-teal" type="submit">Award</button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </PortalFrame>
  );
}
