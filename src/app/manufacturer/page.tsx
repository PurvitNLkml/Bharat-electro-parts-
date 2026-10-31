import { PortalFrame } from "@/components/portal-frame";
import { fieldClass, labelClass, primaryBtn } from "@/components/ui";
import { requireRole } from "@/lib/auth/guard";
import { getRepo } from "@/lib/data";
import { updateBrand } from "@/server/actions";
import Link from "next/link";

export default async function ManufacturerPage() {
  const session = await requireRole("manufacturer");
  const brand = await (await getRepo()).manufacturerHome(session.manufacturerId!);
  if (!brand) return null;
  return (
    <PortalFrame role="manufacturer" title={brand.manufacturer.brandName}>
      <p className="text-sm text-ink-soft">
        Public page: <Link className="underline" href={`/brands/${brand.manufacturer.slug}`}>/brands/{brand.manufacturer.slug}</Link>
      </p>
      <form action={updateBrand} className="mt-4 space-y-3">
        <label><span className={labelClass}>Description</span><textarea className={fieldClass} name="description" defaultValue={brand.manufacturer.description} /></label>
        <label><span className={labelClass}>Website</span><input className={fieldClass} name="website" defaultValue={brand.manufacturer.website} /></label>
        <button className={primaryBtn} type="submit">Save brand</button>
      </form>
      <h2 className="mt-8 font-serif text-2xl">Authorised stockists</h2>
      <ul className="mt-3 space-y-2">
        {brand.stockists.map((stockist) => (
          <li key={stockist.supplierId} className="rounded-2xl border border-line bg-card p-4">
            <p className="font-semibold">{stockist.companyName}</p>
            <p className="text-sm text-ink-soft">{stockist.city}, {stockist.state}</p>
            <p className="mt-1 font-mono text-sm">{stockist.parts.map((part) => part.mpn).join(", ")}</p>
          </li>
        ))}
      </ul>
    </PortalFrame>
  );
}
