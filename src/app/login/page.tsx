import { FormError, fieldClass, labelClass, primaryBtn } from "@/components/ui";
import { createSeedStore } from "@/lib/demo/seed";
import { copy } from "@/lib/i18n";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { demoSignIn, registerBuyer, requestOtp, verifyOtp } from "@/server/actions";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string; email?: string; next?: string }>;
}) {
  const params = await searchParams;
  const accounts = createSeedStore().users;
  const supabase = isSupabaseConfigured();
  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 md:grid-cols-2">
      <section>
        <h1 className="font-serif text-4xl">{copy.auth.title}</h1>
        <p className="mt-3 text-ink-soft">{supabase ? "We email a one-time code. No password is stored in the app." : copy.auth.demoHint}</p>
        <FormError error={params.error} />
        {!supabase ? (
          <div className="mt-6 grid gap-2">
            {accounts.map((account) => (
              <form key={account.id} action={demoSignIn}>
                <input type="hidden" name="userId" value={account.id} />
                <button className="flex w-full items-center justify-between rounded-2xl border border-line bg-card px-4 py-3 text-left hover:border-copper" type="submit">
                  <span>
                    <span className="block font-semibold">{account.name}</span>
                    <span className="text-sm text-ink-soft">{account.email}</span>
                  </span>
                  <span className="text-xs uppercase tracking-wide text-copper">{account.role}</span>
                </button>
              </form>
            ))}
          </div>
        ) : null}
        <form action={params.sent ? verifyOtp : requestOtp} className="mt-6 space-y-3">
          <input type="hidden" name="next" value={params.next ?? "/buyer"} />
          <label>
            <span className={labelClass}>{copy.auth.email}</span>
            <input className={fieldClass} name="email" type="email" defaultValue={params.email ?? ""} required />
          </label>
          {params.sent ? (
            <label>
              <span className={labelClass}>{copy.auth.code}</span>
              <input className={fieldClass} name="token" inputMode="numeric" required />
            </label>
          ) : null}
          <button className={primaryBtn} type="submit">{params.sent ? copy.auth.verify : copy.auth.send}</button>
        </form>
      </section>
      <section className="rounded-3xl border border-line bg-card p-5">
        <h2 className="font-serif text-2xl">Buyer account</h2>
        <form action={registerBuyer} className="mt-4 space-y-3">
          <label><span className={labelClass}>Name</span><input className={fieldClass} name="name" required /></label>
          <label><span className={labelClass}>Company</span><input className={fieldClass} name="company" required /></label>
          <label><span className={labelClass}>Email</span><input className={fieldClass} name="email" type="email" required /></label>
          <label><span className={labelClass}>City</span><input className={fieldClass} name="city" required /></label>
          <label><span className={labelClass}>Mobile</span><input className={fieldClass} name="mobile" /></label>
          <button className={primaryBtn} type="submit">Create buyer account</button>
        </form>
      </section>
    </div>
  );
}
