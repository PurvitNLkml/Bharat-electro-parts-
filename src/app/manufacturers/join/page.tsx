import { FormError, fieldClass, labelClass, primaryBtn } from "@/components/ui";
import { registerManufacturer } from "@/server/actions";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "List a brand" };

export default async function JoinManufacturerPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="font-serif text-4xl">List a brand</h1>
      <p className="mt-3 text-ink-soft">A brand page shows your parts and the authorised suppliers who stock them.</p>
      <form action={registerManufacturer} className="mt-6 space-y-3">
        <FormError error={error} />
        <label><span className={labelClass}>Brand name</span><input className={fieldClass} name="brandName" required /></label>
        <label><span className={labelClass}>Contact name</span><input className={fieldClass} name="contactName" required /></label>
        <label><span className={labelClass}>Email</span><input className={fieldClass} name="email" type="email" required /></label>
        <label><span className={labelClass}>Website</span><input className={fieldClass} name="website" /></label>
        <label><span className={labelClass}>City</span><input className={fieldClass} name="city" /></label>
        <label><span className={labelClass}>Description</span><textarea className={fieldClass} name="description" /></label>
        <button className={primaryBtn} type="submit">Create brand</button>
      </form>
    </div>
  );
}
