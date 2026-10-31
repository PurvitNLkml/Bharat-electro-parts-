import { getRepo } from "@/lib/data";
import { copy } from "@/lib/i18n";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const categories = await (await getRepo()).categoryCounts();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-serif text-4xl">{copy.nav.categories}</h1>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {categories.map((category) => (
          <Link key={category.slug} href={`/categories/${category.slug}`} className="rounded-3xl border border-line bg-card p-5 hover:border-copper">
            <h2 className="font-serif text-2xl">{category.name}</h2>
            <p className="mt-2 text-sm text-ink-soft">{category.count} fresh lines in stock</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
