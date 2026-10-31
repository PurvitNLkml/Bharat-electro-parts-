import { FormError, fieldClass, labelClass, primaryBtn } from "@/components/ui";
import { PortalFrame } from "@/components/portal-frame";
import { requireRole } from "@/lib/auth/guard";
import { getRepo } from "@/lib/data";
import { formatInr } from "@/lib/format";
import { copy } from "@/lib/i18n";
import { saveBid } from "@/server/actions";
import { notFound } from "next/navigation";

export default async function SupplierRfqPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireRole("supplier");
  const { id } = await params;
  const { error } = await searchParams;
  const rfq = await (await getRepo()).supplierRfq(session.supplierId!, id);
  if (!rfq) notFound();
  const supplier = await (await getRepo()).ownSupplier(session.supplierId!);
  return (
    <PortalFrame role="supplier" title={rfq.title}>
      <p className="text-sm text-ink-soft">{rfq.buyerCompany} · {rfq.buyerCity}</p>
      <p className="mt-2 text-sm">{copy.supplier.sealed}</p>
      {supplier?.status !== "verified" ? <p className="mt-3 text-sm text-warn">{copy.join.pending}</p> : null}
      <FormError error={error} />
      <div className="mt-6 space-y-6">
        {rfq.lines.map((line) => (
          <section key={line.lineId} className="rounded-3xl border border-line bg-card p-4">
            <h2 className="font-mono text-lg">{line.lineNo}. {line.mpn}</h2>
            <p className="text-sm text-ink-soft">{line.manufacturer} · qty {line.qty} · {line.description}</p>
            {line.yourBid ? <p className="mt-2 text-sm">Your bid: {line.yourBid.cantSupply ? "Can't supply" : formatInr(line.yourBid.rate ?? 0)}</p> : null}
            <form action={saveBid} className="mt-4 grid gap-3 md:grid-cols-2">
              <input type="hidden" name="rfqId" value={rfq.id} />
              <input type="hidden" name="rfqLineId" value={line.lineId} />
              <label><span className={labelClass}>Rate</span><input className={fieldClass} name="rate" type="number" step="0.01" defaultValue={line.yourBid?.rate ?? ""} /></label>
              <label><span className={labelClass}>MOQ</span><input className={fieldClass} name="moq" type="number" defaultValue={line.yourBid?.moq ?? ""} /></label>
              <label><span className={labelClass}>Stock</span><input className={fieldClass} name="stock" type="number" defaultValue={line.yourBid?.stock ?? ""} /></label>
              <label><span className={labelClass}>Lead time</span><input className={fieldClass} name="leadTime" defaultValue={line.yourBid?.leadTime ?? ""} /></label>
              <label><span className={labelClass}>Brand</span><input className={fieldClass} name="brand" defaultValue={line.yourBid?.brand ?? ""} /></label>
              <label><span className={labelClass}>Alternate part</span><input className={fieldClass} name="alternatePart" defaultValue={line.yourBid?.alternatePart ?? ""} /></label>
              <label><span className={labelClass}>Date code</span><input className={fieldClass} name="dateCode" defaultValue={line.yourBid?.dateCode ?? ""} /></label>
              <label><span className={labelClass}>Validity</span><input className={fieldClass} name="validity" defaultValue={line.yourBid?.validity ?? ""} /></label>
              <label className="md:col-span-2"><span className={labelClass}>Remarks</span><input className={fieldClass} name="remarks" defaultValue={line.yourBid?.remarks ?? ""} /></label>
              <label className="md:col-span-2"><span className={labelClass}>Attachment</span><input className={fieldClass} name="attachment" type="file" /><span className="mt-1 block text-xs text-ink-soft">{copy.supplier.attachment}</span></label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="cantSupply" defaultChecked={line.yourBid?.cantSupply ?? false} /> {copy.supplier.cant}</label>
              <button className={primaryBtn} type="submit" disabled={supplier?.status !== "verified" || line.awarded}>{copy.supplier.bid}</button>
            </form>
          </section>
        ))}
      </div>
    </PortalFrame>
  );
}
