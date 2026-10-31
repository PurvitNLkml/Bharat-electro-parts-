import "server-only";
import { assertPublishedSheetUrl } from "@/lib/domain/sheet-url";
import { parseTabular, type Tabular } from "@/lib/domain/tabular";

export async function fetchPublishedSheet(raw: string): Promise<Tabular> {
  const requested = assertPublishedSheetUrl(raw);
  const response = await fetch(requested, {
    redirect: "follow",
    signal: AbortSignal.timeout(8000),
    headers: { accept: "text/csv,text/plain" },
  });
  assertPublishedSheetUrl(response.url);
  if (!response.ok) throw new Error("The sheet did not download. Publish it to the web as CSV.");
  const text = await response.text();
  if (text.length > 2_000_000) throw new Error("That sheet is too large to sync from here.");
  return parseTabular(text, "sheet.csv");
}
