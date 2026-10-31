import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20">
      <h1 className="font-serif text-4xl">That page is not on the shelf.</h1>
      <Link href="/search" className="mt-6 inline-flex rounded-full bg-copper px-4 py-2 font-semibold text-white">
        Search stock
      </Link>
    </div>
  );
}
