import { DataView } from "@/components/data-view";
import { getRepo } from "@/lib/data";
import { categoryName } from "@/lib/domain/categories";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: categoryName(slug) };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const name = categoryName(slug);
  if (name === slug && slug !== "rf") notFound();
  const rows = await (await getRepo()).search({ category: slug, inStock: true });
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-serif text-4xl">{name}</h1>
      <div className="mt-6">
        <DataView
          screen={`category-${slug}`}
          columns={[
            { key: "mpn", title: "MPN", width: 180 },
            { key: "manufacturer", title: "Manufacturer", width: 180 },
            { key: "qty", title: "Qty", kind: "number" },
            { key: "city", title: "City" },
            { key: "package", title: "Package" },
          ]}
          rows={rows.map((row) => ({ mpn: row.mpn, manufacturer: row.manufacturer, description: row.description, qty: row.qty, city: row.city, package: row.package }))}
          rowAction="quote"
        />
      </div>
    </div>
  );
}
