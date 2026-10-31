"use client";

import { addToTray } from "@/lib/tray";
import { copy } from "@/lib/i18n";
import { useState } from "react";
import { ghostBtn } from "./ui";

export function QuoteButton({ mpn, manufacturer, description }: { mpn: string; manufacturer: string; description: string }) {
  const [added, setAdded] = useState(false);
  return (
    <button
      type="button"
      className={ghostBtn}
      onClick={() => {
        addToTray({ mpn, manufacturer, description, qty: 1 });
        setAdded(true);
      }}
    >
      {added ? "Added" : copy.search.quote}
    </button>
  );
}
