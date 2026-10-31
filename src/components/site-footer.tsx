import { copy } from "@/lib/i18n";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-ink text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-4 py-8 text-sm">
        <div>
          <p className="font-serif text-xl">BharatElectroParts</p>
          <p className="mt-2 max-w-md text-white/80">{copy.operator}</p>
        </div>
        <nav className="flex flex-wrap gap-4">
          <Link href="/how-it-works">{copy.nav.how}</Link>
          <Link href="/suppliers/join">{copy.nav.sell}</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
        </nav>
      </div>
    </footer>
  );
}
