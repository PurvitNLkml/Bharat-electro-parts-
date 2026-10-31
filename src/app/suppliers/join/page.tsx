import { FormError, fieldClass, labelClass, primaryBtn } from "@/components/ui";
import { INDIAN_STATES } from "@/lib/domain/categories";
import { copy } from "@/lib/i18n";
import { registerSupplier } from "@/server/actions";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Supplier sign-up", description: copy.join.lede };

export default async function JoinSupplierPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 md:grid-cols-[0.8fr_1.2fr]">
      <div>
        <h1 className="font-serif text-4xl">{copy.join.title}</h1>
        <p className="mt-4 leading-7 text-ink-soft">{copy.join.lede}</p>
        <p className="mt-4 leading-7 text-ink-soft">{copy.join.pending}</p>
      </div>
      <form action={registerSupplier} className="space-y-3 rounded-3xl border border-line bg-card p-5">
        <FormError error={error} />
        <label><span className={labelClass}>Company</span><input className={fieldClass} name="companyName" required /></label>
        <label><span className={labelClass}>Contact person</span><input className={fieldClass} name="contactPerson" required /></label>
        <label><span className={labelClass}>Mobile</span><input className={fieldClass} name="mobile" required /></label>
        <label><span className={labelClass}>Email</span><input className={fieldClass} name="email" type="email" required /></label>
        <label><span className={labelClass}>GSTIN</span><input className={fieldClass} name="gstin" required placeholder="24AABCM1234R1ZE" /></label>
        <label><span className={labelClass}>City</span><input className={fieldClass} name="city" required /></label>
        <label>
          <span className={labelClass}>State</span>
          <select className={fieldClass} name="state" required defaultValue="Gujarat">
            {INDIAN_STATES.map((state) => (
              <option key={state}>{state}</option>
            ))}
          </select>
        </label>
        <button className={primaryBtn} type="submit">Create supplier account</button>
      </form>
    </div>
  );
}
