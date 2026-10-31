export type TrayLine = {
  mpn: string;
  manufacturer: string;
  description: string;
  qty: number;
};

const KEY = "bep-quote-tray";

export function readTray(): TrayLine[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as TrayLine[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeTray(lines: TrayLine[]) {
  window.localStorage.setItem(KEY, JSON.stringify(lines));
  window.dispatchEvent(new Event("bep-tray"));
}

export function addToTray(line: TrayLine) {
  const next = readTray().filter((row) => row.mpn !== line.mpn);
  next.push(line);
  writeTray(next);
}

export function clearTray() {
  writeTray([]);
}
