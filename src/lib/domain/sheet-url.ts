const ALLOWED = [
  /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9-_]+\/(?:export|pub)(?:\?|#|$)/,
  /^https:\/\/docs\.google\.com\/spreadsheets\/d\/e\/[a-zA-Z0-9-_]+\/pub(?:\?|#|$)/,
];

export function assertPublishedSheetUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Enter a published Google Sheet CSV link.");
  }
  if (url.username || url.password) throw new Error("That link is not a public sheet URL.");
  const asText = url.toString();
  if (!ALLOWED.some((pattern) => pattern.test(asText))) {
    throw new Error("Use a published CSV link from Google Sheets (File → Share → Publish to web, CSV).");
  }
  const csv =
    url.searchParams.get("output") === "csv" ||
    url.searchParams.get("format") === "csv" ||
    url.pathname.endsWith("/export") ||
    url.pathname.endsWith("/pub");
  if (!csv) throw new Error("The link must be the CSV export or the published CSV.");
  return url;
}

export function isAllowedSheetUrl(raw: string): boolean {
  try {
    assertPublishedSheetUrl(raw);
    return true;
  } catch {
    return false;
  }
}
