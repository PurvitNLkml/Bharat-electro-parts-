import { copy } from "@/lib/i18n";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "How it works", description: copy.how.body };

export default function HowPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-serif text-4xl">{copy.how.title}</h1>
      <p className="mt-4 text-lg leading-8 text-ink-soft">{copy.how.body}</p>
      <ol className="mt-8 space-y-4">
        {[copy.home.step1Body, copy.home.step2Body, copy.home.step3Body].map((step) => (
          <li key={step} className="rounded-2xl border border-line bg-card p-4">{step}</li>
        ))}
      </ol>
    </article>
  );
}
