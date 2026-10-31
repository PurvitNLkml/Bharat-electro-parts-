import { FormError, fieldClass, labelClass, primaryBtn } from "@/components/ui";
import { PortalFrame } from "@/components/portal-frame";
import { requireRole } from "@/lib/auth/guard";
import { getRepo } from "@/lib/data";
import { CATEGORIES, INDIAN_STATES } from "@/lib/domain/categories";
import { saveStockForm } from "@/server/actions";

export default async function NewStockPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await requireRole("supplier");
  const { error } = await searchParams;
  const supplier = await (await getRepo()).ownSupplier(session.supplierId!);
  return (
    <PortalFrame role="supplier" title="Add a part">
      <form action={saveStockForm} className="grid gap-3 md:grid-cols-2">
        <FormError error={error} />
        <label><span className={labelClass}>MPN</span><input className={fieldClass} name="mpn" required /></label>
        <label><span className={labelClass}>Manufacturer</span><input className={fieldClass} name="manufacturer" required /></label>
        <label className="md:col-span-2"><span className={labelClass}>Description</span><input className={fieldClass} name="description" /></label>
        <label>
          <span className={labelClass}>Category</span>
          <select className={fieldClass} name="category">
            {CATEGORIES.map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}
          </select>
        </label>
        <label><span className={labelClass}>Package</span><input className={fieldClass} name="package" /></label>
        <label><span className={labelClass}>Qty in stock</span><input className={fieldClass} name="qty" type="number" min="0" defaultValue="0" /></label>
        <label><span className={labelClass}>MOQ</span><input className={fieldClass} name="moq" type="number" min="0" defaultValue="1" /></label>
        <label>
          <span className={labelClass}>GST</span>
          <select className={fieldClass} name="gstMode"><option value="extra">GST extra</option><option value="inclusive">GST included</option></select>
        </label>
        <label><span className={labelClass}>Lead time</span><input className={fieldClass} name="leadTime" /></label>
        <label><span className={labelClass}>Date code</span><input className={fieldClass} name="dateCode" /></label>
        <label><span className={labelClass}>City</span><input className={fieldClass} name="city" defaultValue={supplier?.city ?? ""} required /></label>
        <label>
          <span className={labelClass}>State</span>
          <select className={fieldClass} name="state" defaultValue={supplier?.state ?? "Gujarat"}>
            {INDIAN_STATES.map((state) => <option key={state}>{state}</option>)}
          </select>
        </label>
        <div className="md:col-span-2">
          <p className={labelClass}>Up to 5 private price breaks</p>
          <div className="grid gap-2 md:grid-cols-5">
            {[1, 2, 3, 4, 5].map((index) => (
              <div key={index} className="rounded-xl border border-line p-2">
                <input className={fieldClass} name={`minQty${index}`} type="number" placeholder="Qty" />
                <input className={`${fieldClass} mt-2`} name={`rate${index}`} type="number" step="0.01" placeholder="Rate" />
              </div>
            ))}
          </div>
        </div>
        <button className={primaryBtn} type="submit">Save listing</button>
      </form>
    </PortalFrame>
  );
}
