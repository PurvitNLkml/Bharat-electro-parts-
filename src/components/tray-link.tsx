"use client";

import { readTray } from "@/lib/tray";
import Link from "next/link";
import { useEffect, useState } from "react";

export function TrayLink() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const read = () => setCount(readTray().length);
    read();
    window.addEventListener("bep-tray", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("bep-tray", read);
      window.removeEventListener("storage", read);
    };
  }, []);
  if (count === 0) return null;
  return (
    <Link href="/buyer/rfqs/new" className="rounded-full bg-white/10 px-3 py-1">
      {count} in quote tray
    </Link>
  );
}
