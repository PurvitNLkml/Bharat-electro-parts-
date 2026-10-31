"use client";

import { RfqComposer } from "@/components/stock-tools";
import { clearTray, readTray } from "@/lib/tray";
import { useEffect, useState } from "react";

export function TraySeed({ initial }: { initial: { mpn: string; manufacturer: string; description: string; qty: number }[] }) {
  const [lines, setLines] = useState(initial);
  const [ready, setReady] = useState(initial.length > 0);
  useEffect(() => {
    if (initial.length > 0) return;
    const tray = readTray();
    /* eslint-disable react-hooks/set-state-in-effect -- quote tray is localStorage-only */
    if (tray.length) {
      setLines(tray);
      clearTray();
    }
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [initial]);
  if (!ready) return null;
  return <RfqComposer initial={lines.length ? lines : [{ mpn: "", manufacturer: "", description: "", qty: 1 }]} />;
}
