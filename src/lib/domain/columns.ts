export type FieldDef = {
  key: string;
  label: string;
  required: boolean;
  aliases: string[];
};

export const STOCK_FIELDS: FieldDef[] = [
  { key: "mpn", label: "MPN", required: true, aliases: ["mpn", "part", "partnumber", "part number", "mfr part", "manufacturer part number", "mfr. part"] },
  { key: "manufacturer", label: "Manufacturer", required: true, aliases: ["manufacturer", "mfr", "mfg", "brand", "maker"] },
  { key: "description", label: "Description", required: false, aliases: ["description", "desc", "details"] },
  { key: "category", label: "Category", required: true, aliases: ["category", "commodity", "group"] },
  { key: "package", label: "Package", required: false, aliases: ["package", "pkg", "case", "footprint"] },
  { key: "qty", label: "Qty in stock", required: true, aliases: ["qty", "quantity", "qty in stock", "stock", "on hand"] },
  { key: "moq", label: "MOQ", required: false, aliases: ["moq", "min order", "minimum order"] },
  { key: "gstMode", label: "GST", required: false, aliases: ["gst", "gst mode", "tax"] },
  { key: "leadTime", label: "Lead time", required: false, aliases: ["lead time", "leadtime", "delivery"] },
  { key: "dateCode", label: "Date code", required: false, aliases: ["date code", "datecode", "dc"] },
  { key: "city", label: "City", required: true, aliases: ["city", "location"] },
  { key: "state", label: "State", required: true, aliases: ["state", "region"] },
  { key: "rate", label: "Rate (first break)", required: false, aliases: ["rate", "price", "unit price", "inr"] },
  { key: "breakQty", label: "Break qty", required: false, aliases: ["break qty", "price qty", "min qty"] },
];

export const BOM_FIELDS: FieldDef[] = [
  { key: "mpn", label: "MPN", required: true, aliases: ["mpn", "part", "partnumber", "part number", "manufacturer part number"] },
  { key: "manufacturer", label: "Manufacturer", required: false, aliases: ["manufacturer", "mfr", "mfg", "brand"] },
  { key: "description", label: "Description", required: false, aliases: ["description", "desc", "value"] },
  { key: "qty", label: "Qty", required: true, aliases: ["qty", "quantity", "qty per board"] },
  { key: "refdes", label: "Refdes", required: false, aliases: ["refdes", "ref", "designator", "reference"] },
  { key: "package", label: "Package", required: false, aliases: ["package", "pkg", "footprint"] },
];

function normHeader(value: string): string {
  return value.toLowerCase().replace(/[_./]+/g, " ").replace(/\s+/g, " ").trim();
}

export function autoMap(headers: string[], fields: FieldDef[]): Record<string, string | null> {
  const used = new Set<string>();
  const mapping: Record<string, string | null> = {};
  for (const field of fields) {
    const aliases = new Set(field.aliases.map(normHeader));
    aliases.add(normHeader(field.label));
    aliases.add(normHeader(field.key));
    const match = headers.find((header) => !used.has(header) && aliases.has(normHeader(header)));
    mapping[field.key] = match ?? null;
    if (match) used.add(match);
  }
  return mapping;
}

export function applyMapping(rows: Record<string, string>[], mapping: Record<string, string | null>): Record<string, string>[] {
  return rows.map((row) => {
    const next: Record<string, string> = {};
    for (const [field, header] of Object.entries(mapping)) {
      next[field] = header ? (row[header] ?? "").trim() : "";
    }
    return next;
  });
}
