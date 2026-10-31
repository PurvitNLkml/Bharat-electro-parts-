import * as XLSX from "xlsx";

export type Tabular = {
  headers: string[];
  rows: Record<string, string>[];
};

export function parseTabular(data: ArrayBuffer | Uint8Array | string, filename = "upload.csv"): Tabular {
  const workbook = XLSX.read(data, { type: typeof data === "string" ? "string" : "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { headers: [], rows: [] };
  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });
  const headerRow = (matrix[0] ?? []).map((cell, index) => {
    const text = String(cell ?? "").trim();
    return text || `Column ${index + 1}`;
  });
  const rows = matrix.slice(1).map((cells) => {
    const row: Record<string, string> = {};
    headerRow.forEach((header, index) => {
      row[header] = String(cells?.[index] ?? "").trim();
    });
    return row;
  });
  if (filename.endsWith(".empty")) return { headers: [], rows: [] };
  return { headers: headerRow.filter((header) => header.trim().length > 0), rows };
}

export function toCsv(headers: string[], rows: Record<string, string | number | boolean | null>[]): string {
  const escape = (value: string) => {
    if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
  };
  const lines = [headers.map(escape).join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => escape(String(row[header] ?? ""))).join(","));
  }
  return lines.join("\n");
}
