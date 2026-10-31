# BharatElectroParts

BharatElectroParts.com is an Indian electronic-parts marketplace for hardware developers, startups, and manufacturers. It is operated by Sonani Electronics.

Find electronic parts in ready stock across India, and get sealed quotes for what isn't.

## What this Phase 1 build includes

- Public pages: home, search, part, category, brand, supplier sign-up, how it works, terms, and privacy.
- Supplier portal: sign-up with GSTIN check, single-part form, Excel-like grid (paste), Excel/CSV upload with column mapping and a row report, and a published Google Sheet CSV sync.
- Buyer portal: ready-stock search that shows availability without supplier identity or private price breaks, a quote tray, multiple BOMs with revisions and a diff, exact-then-fuzzy matching, and RFQs for unmatched lines.
- Manufacturer portal: a brand page of parts and authorised stockists.
- Admin console: supplier verification, RFQ routing, all bids, award, and fraud flags.
- Every list can switch between cards, a table, and a Jspreadsheet CE sheet (filter, sort, paste, CSV/Excel export, saved views). The sheet scrolls sideways on a phone.
- Sealed bids: a supplier cannot read another supplier's bid, rate, or identity, and the API does not expose rank or a running best price. Buyers see quote terms. The supplier name appears only on the awarded bid.
- Nothing is written until submit. Opening a form does not insert a draft row.
- Bid files go to a private `bid-attachments` bucket and are opened with a short-lived signed URL.
- English copy lives in `src/lib/i18n/en.ts` so Hindi and Gujarati can be added later.

## Demo mode

If `NEXT_PUBLIC_SUPABASE_URL` and a publishable or anon key are missing, the app runs on seeded in-memory data. Sign in from `/login` as a buyer, supplier, manufacturer, or admin. Demo sessions live in an httpOnly cookie signed with `DEMO_SESSION_SECRET` (or a built-in preview secret). Restarting the server resets the seed. Do not put real customer data in demo mode.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

## Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run `supabase/migrations/20261031120000_init.sql`, then `supabase/seed.sql`.
   With the Supabase CLI locally: `supabase db reset` after you link the project, or paste both files into the SQL editor.
3. Authentication → Providers → Email. Keep email OTP enabled. The app calls `signInWithOtp` and `verifyOtp`. It does not read roles from user metadata. Roles live in `public.profiles`.
4. Confirm the `bid-attachments` bucket exists and is private. The migration creates it.
5. Copy the project URL and publishable key into `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
DEMO_SESSION_SECRET=a-long-random-string
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Older projects can set `NEXT_PUBLIC_SUPABASE_ANON_KEY` instead of the publishable key. Never put the service role key in a `NEXT_PUBLIC_` variable.

6. `npm run dev` again. New supplier accounts stay pending until an admin verifies them. Bids are rejected until then. Listings can be published immediately.

Search uses Postgres full text plus `pg_trgm`. The default catalogue hides rows whose `last_updated` is older than 14 days. Row level security is enabled on every public table. Supplier identity and price breaks are not columns on the public listing. Bid ownership is a separate table, and `public.awarded_supplier` returns a name only when the current buyer awarded that bid.

If `seed.sql` fails on `auth.users` because the hosted auth schema differs, skip the auth inserts, sign up through the app, and load stock from the supplier portal. The public seed expects the fixed UUIDs in that file.

## Cloudflare

The app is a Next.js App Router project adapted with OpenNext.

```bash
npx wrangler login
npm run deploy
```

`npm run preview` builds and serves the Workers output locally. Set the same environment variables in the Cloudflare dashboard (or with `wrangler secret put`) before production traffic. `compatibility_date` is `2026-10-31` and `nodejs_compat` is on. See `wrangler.jsonc` and `open-next.config.ts`.

`npm run build` is the Next.js build. `npm run deploy` runs OpenNext and then Wrangler.

## Checks

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Tests cover sealed-bid projection, the demo repository, BOM exact/fuzzy matching and revision diffs, the 14-day search window, GSTIN checksums, the Google Sheet URL allowlist, and the SQL policies (no public security-definer functions, private price breaks, private storage bucket, no rank aggregate).

## Left for later

- Hindi and Gujarati dictionaries.
- A connected Supabase project and production email delivery.
- Payments, freight, purchase orders, and GST e-invoice.
- WhatsApp or SMS notices when an RFQ is routed.
- Multi-user company accounts and an audit log.
- Part photos and datasheets.
- Richer fraud signals than the GSTIN, duplicate-mobile, and zero-rate checks.
- R2 incremental cache for the OpenNext deploy.
