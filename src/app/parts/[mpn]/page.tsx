import { QuoteButton } from "@/components/quote-button";
import { Pill } from "@/components/ui";
import { getRepo } from "@/lib/data";
import { categoryName } from "@/lib/domain/categories";
import { gstLabel } from "@/lib/format";
import { copy } from "@/lib/i18n";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ mpn: string }> }): Promise<Metadata> {
  const { mpn } = await params;
  const part = decodeURIComponent(mpn);
  return { title: part, description: `${part} availability on BharatElectroParts. ${copy.tagline}` };
}

export default async function PartPage({ params }: { params: Promise<{ mpn: string }> }) {
  const { mpn } = await params;
  const part = await (await getRepo()).part(decodeURIComponent(mpn));
  if (!part) notFound();
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-sm text-ink-soft">
        <Link href={`/categories/${part.category}`}>{categoryName(part.category)}</Link>
      </p>
      <h1 className="mt-2 font-mono text-3xl md:text-4xl">{part.mpn}</h1>
      <p className="mt-2 text-lg">{part.manufacturer}</p>
      <p className="mt-2 max-w-2xl text-ink-soft">{part.description}</p>
      <div className="mt-4">
        <QuoteButton mpn={part.mpn} manufacturer={part.manufacturer} description={part.description} />
      </div>
      <h2 className="mt-10 font-serif text-3xl">{copy.part.availability}</h2>
      <p className="mt-2 text-sm text-ink-soft">{copy.home.shelfNote}</p>
      <ul className="mt-4 space-y-3">
        {part.listings.map((row) => (
          <li key={row.id} className="rounded-2xl border border-line bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="good">{row.qty.toLocaleString("en-IN")} in stock</Pill>
              <Pill>{row.city}</Pill>
              <Pill tone="teal">{gstLabel(row.gstMode)}</Pill>
            </div>
            <p className="mt-3 text-sm">
              MOQ {row.moq} · {row.package || "Package not listed"} · Date code {row.dateCode || "—"} · {row.leadTime || "Lead time not listed"}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
