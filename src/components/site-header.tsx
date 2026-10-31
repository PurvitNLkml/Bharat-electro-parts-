import { demoMode } from "@/lib/data";
import { getSession } from "@/lib/auth/session";
import { copy } from "@/lib/i18n";
import Link from "next/link";
import { signOut } from "@/server/actions";
import { TrayLink } from "./tray-link";

function homeFor(role: string) {
  if (role === "supplier") return "/supplier";
  if (role === "manufacturer") return "/manufacturer";
  if (role === "admin") return "/admin";
  return "/buyer";
}

export async function SiteHeader() {
  const session = await getSession();
  return (
    <header className="border-b border-line bg-ink text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-4">
        <Link href="/" className="font-serif text-2xl tracking-tight">
          Bharat<span className="text-copper">ElectroParts</span>
        </Link>
        <nav className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <Link href="/search">{copy.nav.search}</Link>
          <Link href="/categories">{copy.nav.categories}</Link>
          <Link href="/brands">{copy.nav.brands}</Link>
          <Link href="/how-it-works">{copy.nav.how}</Link>
          <Link href="/suppliers/join">{copy.nav.sell}</Link>
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <TrayLink />
          {session ? (
            <>
              <Link href={homeFor(session.role)} className="font-semibold">
                {session.name}
              </Link>
              <form action={signOut}>
                <button className="rounded-full border border-white/20 px-3 py-1" type="submit">
                  {copy.nav.signOut}
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="rounded-full bg-copper px-4 py-2 font-semibold">
              {copy.nav.signIn}
            </Link>
          )}
        </div>
      </div>
      {demoMode() ? <p className="bg-copper-dark px-4 py-2 text-center text-sm">{copy.demo}</p> : null}
    </header>
  );
}
