import { copy } from "@/lib/i18n";
import type { Metadata } from "next";

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-serif text-4xl">{copy.legal.privacyTitle}</h1>
      <p className="mt-4 leading-7">
        {copy.operator} Account email is used to sign in with a one-time code when Supabase is connected. Role and company details are stored in application tables, not in editable user metadata.
      </p>
      <p className="mt-4 leading-7">
        Bid attachments sit in a private storage bucket. The app hands out a short-lived signed URL after checking that the viewer is allowed to see that quote. Public search does not include supplier identity or private price breaks.
      </p>
      <p className="mt-4 leading-7">
        Demo mode, used when Supabase environment variables are absent, keeps seeded data in the server process and signs demo session cookies locally. Do not use demo mode for real customer data.
      </p>
    </article>
  );
}

export const metadata: Metadata = { title: "Privacy" };
