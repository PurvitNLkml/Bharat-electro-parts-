import { FileLink } from "@/components/file-link";
import { PortalFrame } from "@/components/portal-frame";
import { Pill } from "@/components/ui";
import { requireRole } from "@/lib/auth/guard";
import { getRepo } from "@/lib/data";
import { formatInr, formatWhen } from "@/lib/format";
import { copy } from "@/lib/i18n";
import { notFound } from "next/navigation";

export default async function BuyerRfqPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole("buyer");
  const { id } = await params;
  const rfq = await (await getRepo()).buyerRfq(session.buyerId!, id);
  if (!rfq) notFound();
  return (
    <PortalFrame role="buyer" title={rfq.title}>
      <p className="text-sm text-ink-soft">{rfq.status} · {formatWhen(rfq.createdAt)}</p>
      <p className="mt-2 max-w-2xl text-sm">{copy.buyer.sealedQuote} until a line is awarded.</p>
      <div className="mt-6 space-y-6">
        {rfq.lines.map((line) => (
          <section key={line.lineId} className="rounded-3xl border border-line bg-card p-4">
            <h2 className="font-mono text-lg">{line.mpn}</h2>
            <p className="text-sm text-ink-soft">{line.manufacturer} · qty {line.qty}</p>
            <div className="mt-3 grid gap-3">
              {line.bids.length === 0 ? <p className="text-sm text-ink-soft">No quotes on this line yet.</p> : null}
              {line.bids.map((bid) => (
                <article key={bid.id} className="rounded-2xl border border-line p-3">
                  <div className="flex flex-wrap gap-2">
                    {bid.cantSupply ? <Pill tone="warn">Can&apos;t supply</Pill> : <Pill tone="good">{bid.rate != null ? formatInr(bid.rate) : "Quote"}</Pill>}
                    <Pill>{bid.supplier.revealed ? bid.supplier.companyName : copy.buyer.sealedQuote}</Pill>
                  </div>
                  {bid.supplier.revealed ? <p className="mt-2 text-sm">{copy.buyer.awarded}: {bid.supplier.companyName}, {bid.supplier.city}. {bid.supplier.email} · {bid.supplier.mobile}</p> : null}
                  <p className="mt-2 text-sm">MOQ {bid.moq ?? "—"} · stock {bid.stock ?? "—"} · {bid.leadTime || "Lead time not stated"} · {bid.brand || "Brand not stated"}</p>
                  {bid.alternatePart ? <p className="text-sm">Alternate: {bid.alternatePart}</p> : null}
                  {bid.remarks ? <p className="text-sm text-ink-soft">{bid.remarks}</p> : null}
                  {bid.attachmentPath && bid.attachmentName ? <FileLink path={bid.attachmentPath} name={bid.attachmentName} /> : null}
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </PortalFrame>
  );
}
