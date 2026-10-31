import { DataView } from "@/components/data-view";
import { getRepo } from "@/lib/data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const brand = await (await getRepo()).brand(slug);
  return { title: brand?.manufacturer.brandName ?? "Brand", description: brand?.manufacturer.description };
}

export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = await (await getRepo()).brand(slug);
  if (!brand) notFound();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-serif text-4xl">{brand.manufacturer.brandName}</h1>
      <p className="mt-3 max-w-3xl text-ink-soft">{brand.manufacturer.description}</p>
      {brand.manufacturer.website ? (
        <p className="mt-2 text-sm">
          <a className="underline" href={brand.manufacturer.website}>{brand.manufacturer.website}</a>
        </p>
      ) : null}
      <h2 className="mt-8 font-serif text-2xl">Parts in ready stock</h2>
      <div className="mt-4">
        <DataView
          screen={`brand-${slug}`}
          columns={[
            { key: "mpn", title: "MPN", width: 160 },
            { key: "qty", title: "Qty", kind: "number" },
            { key: "city", title: "City" },
            { key: "package", title: "Package" },
          ]}
          rows={brand.parts.map((part) => ({ mpn: part.mpn, qty: part.qty, city: part.city, package: part.package }))}
        />
      </div>
      <h2 className="mt-10 font-serif text-2xl">Authorised suppliers</h2>
      <div className="mt-4 grid gap-3">
        {brand.stockists.map((stockist) => (
          <article key={stockist.supplierId} className="rounded-2xl border border-line bg-card p-4">
            <h3 className="font-semibold">{stockist.companyName}</h3>
            <p className="text-sm text-ink-soft">{stockist.city}, {stockist.state}</p>
            <ul className="mt-2 text-sm">
              {stockist.parts.map((part) => (
                <li key={part.mpn} className="font-mono">
                  {part.mpn} · {part.qty.toLocaleString("en-IN")} · {part.city}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
