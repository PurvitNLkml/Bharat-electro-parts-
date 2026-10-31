import { getRepo } from "@/lib/data";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Brands" };

export default async function BrandsPage() {
  const brands = await (await getRepo()).brands();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-serif text-4xl">Brands</h1>
      <div className="mt-6 grid gap-3">
        {brands.map((brand) => (
          <Link key={brand.slug} href={`/brands/${brand.slug}`} className="rounded-3xl border border-line bg-card p-5 hover:border-copper">
            <h2 className="font-serif text-2xl">{brand.brandName}</h2>
            <p className="mt-2 text-sm text-ink-soft">{brand.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
