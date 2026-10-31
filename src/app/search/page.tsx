import { DataView } from "@/components/data-view";
import { fieldClass, labelClass } from "@/components/ui";
import { getRepo } from "@/lib/data";
import { CATEGORIES } from "@/lib/domain/categories";
import { copy } from "@/lib/i18n";
import { gstLabel } from "@/lib/format";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Search stock" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; city?: string; stock?: string; stale?: string }>;
}) {
  const params = await searchParams;
  const repo = await getRepo();
  const [rows, cities] = await Promise.all([
    repo.search({
      q: params.q,
      category: params.category,
      city: params.city,
      inStock: params.stock === "1",
      includeStale: params.stale === "1",
    }),
    repo.cities(),
  ]);
  const gridRows = rows.map((row) => ({
    mpn: row.mpn,
    manufacturer: row.manufacturer,
    description: row.description,
    category: row.category,
    package: row.package,
    qty: row.qty,
    moq: row.moq,
    city: row.city,
    dateCode: row.dateCode,
    leadTime: row.leadTime,
    gst: gstLabel(row.gstMode),
  }));
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-serif text-4xl">{copy.search.title}</h1>
      <form className="mt-6 grid gap-3 rounded-3xl border border-line bg-card p-4 md:grid-cols-6">
        <label className="md:col-span-2">
          <span className={labelClass}>MPN or keyword</span>
          <input className={fieldClass} name="q" defaultValue={params.q ?? ""} />
        </label>
        <label>
          <span className={labelClass}>{copy.search.category}</span>
          <select className={fieldClass} name="category" defaultValue={params.category ?? ""}>
            <option value="">{copy.search.all}</option>
            {CATEGORIES.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={labelClass}>{copy.search.city}</span>
          <select className={fieldClass} name="city" defaultValue={params.city ?? ""}>
            <option value="">{copy.search.all}</option>
            {cities.map((city) => (
              <option key={city}>{city}</option>
            ))}
          </select>
        </label>
        <label className="flex items-end gap-2 text-sm">
          <input type="checkbox" name="stock" value="1" defaultChecked={params.stock === "1"} />
          {copy.search.inStock}
        </label>
        <label className="flex items-end gap-2 text-sm md:col-span-2">
          <input type="checkbox" name="stale" value="1" defaultChecked={params.stale === "1"} />
          {copy.search.stale}
        </label>
        <button className="min-h-11 rounded-full bg-copper px-4 font-semibold text-white md:col-span-1" type="submit">
          {copy.nav.search}
        </button>
      </form>
      <div className="mt-6">
        <DataView
          screen="search"
          columns={[
            { key: "mpn", title: "MPN", width: 180 },
            { key: "manufacturer", title: "Manufacturer", width: 180 },
            { key: "qty", title: "Qty", kind: "number", width: 90 },
            { key: "moq", title: "MOQ", kind: "number", width: 80 },
            { key: "city", title: "City" },
            { key: "package", title: "Package" },
            { key: "dateCode", title: "Date code" },
            { key: "leadTime", title: "Lead time" },
            { key: "gst", title: "GST" },
            { key: "category", title: "Category" },
          ]}
          rows={gridRows}
          empty={copy.search.empty}
          rowAction="quote"
        />
      </div>
    </div>
  );
}
