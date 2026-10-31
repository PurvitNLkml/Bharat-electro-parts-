import { copy } from "@/lib/i18n";
import { getRepo } from "@/lib/data";
import { categoryName } from "@/lib/domain/categories";
import Link from "next/link";
import { QuoteButton } from "@/components/quote-button";

export default async function HomePage() {
  const listings = (await (await getRepo()).search({})).slice(0, 5);
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
      <section className="grid items-end gap-10 md:grid-cols-[1.3fr_0.7fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-copper">{copy.home.kicker}</p>
          <h1 className="mt-3 max-w-3xl font-serif text-4xl leading-tight text-ink md:text-6xl">{copy.tagline}</h1>
          <p className="mt-5 max-w-xl text-lg text-ink-soft">{copy.home.lede}</p>
          <form action="/search" className="mt-8 flex max-w-xl flex-col gap-2 sm:flex-row">
            <input name="q" placeholder={copy.home.search} className="min-h-12 flex-1 rounded-full border border-line bg-white px-5" />
            <button className="min-h-12 rounded-full bg-copper px-6 font-semibold text-white" type="submit">
              {copy.nav.search}
            </button>
          </form>
        </div>
        <aside className="rounded-3xl border border-line bg-card p-5 shadow-sm">
          <h2 className="font-serif text-2xl">{copy.home.shelf}</h2>
          <p className="mt-1 text-sm text-ink-soft">{copy.home.shelfNote}</p>
          <ul className="mt-4 space-y-3">
            {listings.map((row) => (
              <li key={row.id} className="flex items-start justify-between gap-3 border-t border-line pt-3">
                <div>
                  <Link href={`/parts/${encodeURIComponent(row.mpn)}`} className="font-mono text-sm font-medium">
                    {row.mpn}
                  </Link>
                  <p className="text-sm text-ink-soft">
                    {row.manufacturer} · {row.city} · {row.qty.toLocaleString("en-IN")} pcs
                  </p>
                </div>
                <QuoteButton mpn={row.mpn} manufacturer={row.manufacturer} description={row.description} />
              </li>
            ))}
          </ul>
        </aside>
      </section>
      <section className="mt-16 grid gap-4 md:grid-cols-3">
        {[
          [copy.home.step1, copy.home.step1Body],
          [copy.home.step2, copy.home.step2Body],
          [copy.home.step3, copy.home.step3Body],
        ].map(([title, body]) => (
          <article key={title} className="rounded-3xl border border-line bg-card p-5">
            <h2 className="font-serif text-2xl">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-ink-soft">{body}</p>
          </article>
        ))}
      </section>
      <section className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-ink px-6 py-6 text-white">
        <div>
          <h2 className="font-serif text-3xl">{copy.home.sellTitle}</h2>
          <p className="mt-2 max-w-xl text-white/80">{copy.home.sellBody}</p>
        </div>
        <Link href="/suppliers/join" className="rounded-full bg-copper px-5 py-3 font-semibold">
          {copy.home.sellCta}
        </Link>
      </section>
      <p className="mt-6 text-sm text-ink-soft">Categories such as {categoryName("microcontrollers")} and {categoryName("passives")} are browsable from the catalogue.</p>
    </div>
  );
}
