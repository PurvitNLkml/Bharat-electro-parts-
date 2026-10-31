import { getRepo } from "@/lib/data";
import { CATEGORIES } from "@/lib/domain/categories";
import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const repo = await getRepo();
  const [listings, brands] = await Promise.all([repo.search({ includeStale: true }), repo.brands()]);
  const parts = [...new Set(listings.map((row) => row.mpn))];
  const staticRoutes = ["", "/search", "/categories", "/brands", "/how-it-works", "/suppliers/join", "/terms", "/privacy", "/login"].map(
    (path) => ({ url: path || "/" }),
  );
  return [
    ...staticRoutes,
    ...CATEGORIES.map((category) => ({ url: `/categories/${category.slug}` })),
    ...parts.map((mpn) => ({ url: `/parts/${encodeURIComponent(mpn)}` })),
    ...brands.map((brand) => ({ url: `/brands/${brand.slug}` })),
  ];
}
