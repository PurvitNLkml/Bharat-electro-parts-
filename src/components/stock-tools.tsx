"use client";

import { DataView, type GridRow } from "@/components/data-view";
import { fieldClass, labelClass, primaryBtn } from "@/components/ui";
import { BOM_FIELDS, STOCK_FIELDS, autoMap } from "@/lib/domain/columns";
import { parseTabular } from "@/lib/domain/tabular";
import { previewSheet, saveBom, saveMappedStock, saveRevision, saveRfq, saveStockRows } from "@/server/actions";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const STOCK_COLUMNS = [
  { key: "mpn", title: "MPN", width: 160 },
  { key: "manufacturer", title: "Manufacturer", width: 160 },
  { key: "description", title: "Description", width: 180 },
  { key: "category", title: "Category" },
  { key: "package", title: "Package" },
  { key: "qty", title: "Qty", kind: "number" as const },
  { key: "moq", title: "MOQ", kind: "number" as const },
  { key: "gstMode", title: "GST" },
  { key: "leadTime", title: "Lead time" },
  { key: "dateCode", title: "Date code" },
  { key: "city", title: "City" },
  { key: "state", title: "State" },
  { key: "rate", title: "Rate", kind: "number" as const },
  { key: "breakQty", title: "Break qty", kind: "number" as const },
];

function blank(city: string, state: string): GridRow {
  return {
    mpn: "",
    manufacturer: "",
    description: "",
    category: "passives",
    package: "",
    qty: 0,
    moq: 0,
    gstMode: "extra",
    leadTime: "",
    dateCode: "",
    city,
    state,
    rate: 0,
    breakQty: 0,
  };
}

export function StockGrid({ city, state }: { city: string; state: string }) {
  const [rows, setRows] = useState<GridRow[]>(() => Array.from({ length: 8 }, () => blank(city, state)));
  const [message, setMessage] = useState("");
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">Paste from Excel into the sheet. Nothing is stored until you submit.</p>
      <DataView screen="stock-entry" columns={STOCK_COLUMNS} rows={rows} editable onRowsChange={setRows} />
      <button
        className={primaryBtn}
        type="button"
        onClick={async () => {
          const report = await saveStockRows(
            rows.map((row) => ({
              mpn: String(row.mpn ?? ""),
              manufacturer: String(row.manufacturer ?? ""),
              description: String(row.description ?? ""),
              category: String(row.category ?? "passives"),
              package: String(row.package ?? ""),
              qty: Number(row.qty || 0),
              moq: Number(row.moq || 0),
              gstMode: String(row.gstMode).includes("incl") ? "inclusive" : "extra",
              leadTime: String(row.leadTime ?? ""),
              dateCode: String(row.dateCode ?? ""),
              city: String(row.city || city),
              state: String(row.state || state),
              priceBreaks: Number(row.rate) > 0 ? [{ minQty: Number(row.breakQty || row.moq || 1), rate: Number(row.rate) }] : [],
            })),
          );
          setMessage(`${report.ok} rows saved. ${report.failed.length} rows failed.${report.failed.map((row) => ` Row ${row.row}: ${row.reason}`).join("")}`);
        }}
      >
        Submit stock
      </button>
      {message ? <p className="rounded-xl bg-card p-3 text-sm">{message}</p> : null}
    </div>
  );
}

export function UploadWizard({ kind, city, state, bomId }: { kind: "stock" | "bom"; city?: string; state?: string; bomId?: string }) {
  const router = useRouter();
  const fields = kind === "stock" ? STOCK_FIELDS : BOM_FIELDS;
  const [headers, setHeaders] = useState<string[]>([]);
  const [source, setSource] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [message, setMessage] = useState("");

  async function load(file: File | null, sample?: string) {
    const data = sample ?? (file ? await file.arrayBuffer() : "");
    if (!data) return;
    const table = parseTabular(data, file?.name ?? "sample.csv");
    setHeaders(table.headers);
    setSource(table.rows);
    setMapping(autoMap(table.headers, fields));
  }

  const preview = useMemo(() => source.slice(0, 5), [source]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(event) => void load(event.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold"
          onClick={() => void load(null, kind === "stock" ? SAMPLE_STOCK : SAMPLE_BOM)}
        >
          Use sample file
        </button>
        <a className="self-center text-sm underline" href={kind === "stock" ? "/samples/stock.csv" : "/samples/bom.csv"}>
          Download template
        </a>
      </div>
      {headers.length > 0 ? (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            {fields.map((field) => (
              <label key={field.key}>
                <span className={labelClass}>
                  {field.label}
                  {field.required ? " *" : ""}
                </span>
                <select
                  className={fieldClass}
                  value={mapping[field.key] ?? ""}
                  onChange={(event) => setMapping((current) => ({ ...current, [field.key]: event.target.value || null }))}
                >
                  <option value="">Not in file</option>
                  {headers.map((header) => (
                    <option key={header}>{header}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr>
                  {fields.map((field) => (
                    <th key={field.key} className="px-2 py-1">{field.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, index) => (
                  <tr key={index} className="border-t border-line">
                    {fields.map((field) => (
                      <td key={field.key} className="px-2 py-1">{mapping[field.key] ? row[mapping[field.key]!] : ""}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            className={primaryBtn}
            type="button"
            onClick={async () => {
              const mapped = source.map((row) => {
                const next: Record<string, string> = {};
                for (const field of fields) next[field.key] = mapping[field.key] ? (row[mapping[field.key]!] ?? "") : "";
                return next;
              });
              if (kind === "stock") {
                const report = await saveMappedStock({ rows: mapped, city: city ?? "", state: state ?? "" });
                setMessage(`${report.ok} rows saved. ${report.failed.length} failed.${report.failed.map((row) => ` Row ${row.row}: ${row.reason}`).join("")}`);
              } else {
                const lines = mapped.map((row) => ({
                  mpn: row.mpn ?? "",
                  manufacturer: row.manufacturer ?? "",
                  description: row.description ?? "",
                  qty: Number(row.qty || 0),
                  refdes: row.refdes ?? "",
                  package: row.package ?? "",
                }));
                const result = bomId
                  ? await saveRevision({ bomId, note: "Uploaded revision", lines })
                  : await saveBom({ name: "Uploaded BOM", note: "Uploaded from a file", lines });
                if ("error" in result && result.error) setMessage(result.error);
                else if ("id" in result && result.id) router.push(`/buyer/boms/${result.id}`);
                else if ("revisionId" in result) router.refresh();
              }
            }}
          >
            Submit upload
          </button>
        </>
      ) : null}
      {message ? <p className="rounded-xl bg-card p-3 text-sm">{message}</p> : null}
    </div>
  );
}

export function SheetSync({ city, state }: { city: string; state: string }) {
  const [url, setUrl] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [message, setMessage] = useState("");
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">Paste a published Google Sheet CSV link. The server only fetches docs.google.com CSV exports.</p>
      <div className="flex flex-wrap gap-2">
        <input className={`${fieldClass} max-w-xl`} value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…/export?format=csv" />
        <button
          className={primaryBtn}
          type="button"
          onClick={async () => {
            const table = await previewSheet(url);
            if ("error" in table && table.error) {
              setMessage(table.error);
              return;
            }
            setHeaders(table.headers);
            setRows(table.rows);
            setMapping(autoMap(table.headers, STOCK_FIELDS));
            setMessage(`${table.rows.length} rows read. Map the columns, then submit. Nothing is stored yet.`);
          }}
        >
          Read sheet
        </button>
      </div>
      {headers.length > 0 ? (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            {STOCK_FIELDS.map((field) => (
              <label key={field.key}>
                <span className={labelClass}>{field.label}</span>
                <select className={fieldClass} value={mapping[field.key] ?? ""} onChange={(event) => setMapping((current) => ({ ...current, [field.key]: event.target.value || null }))}>
                  <option value="">Not in sheet</option>
                  {headers.map((header) => (
                    <option key={header}>{header}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <button
            className={primaryBtn}
            type="button"
            onClick={async () => {
              const mapped = rows.map((row) => {
                const next: Record<string, string> = {};
                for (const field of STOCK_FIELDS) next[field.key] = mapping[field.key] ? (row[mapping[field.key]!] ?? "") : "";
                return next;
              });
              const report = await saveMappedStock({ rows: mapped, city, state });
              setMessage(`${report.ok} rows saved. ${report.failed.length} failed.${report.failed.map((row) => ` Row ${row.row}: ${row.reason}`).join("")}`);
            }}
          >
            Sync into stock
          </button>
        </>
      ) : null}
      {message ? <p className="text-sm">{message}</p> : null}
    </div>
  );
}

export function RfqComposer({ initial }: { initial: { mpn: string; manufacturer: string; description: string; qty: number }[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("Quote request");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState(initial);
  const [message, setMessage] = useState("");
  return (
    <div className="space-y-4">
      <label>
        <span className={labelClass}>Title</span>
        <input className={fieldClass} value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label>
        <span className={labelClass}>Notes</span>
        <textarea className={fieldClass} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      {lines.map((line, index) => (
        <div key={index} className="grid gap-2 rounded-2xl border border-line bg-card p-3 md:grid-cols-4">
          <input className={fieldClass} value={line.mpn} placeholder="MPN" onChange={(event) => setLines((current) => current.map((row, i) => i === index ? { ...row, mpn: event.target.value } : row))} />
          <input className={fieldClass} value={line.manufacturer} placeholder="Manufacturer" onChange={(event) => setLines((current) => current.map((row, i) => i === index ? { ...row, manufacturer: event.target.value } : row))} />
          <input className={fieldClass} value={line.description} placeholder="Description" onChange={(event) => setLines((current) => current.map((row, i) => i === index ? { ...row, description: event.target.value } : row))} />
          <input className={fieldClass} type="number" value={line.qty} onChange={(event) => setLines((current) => current.map((row, i) => i === index ? { ...row, qty: Number(event.target.value) } : row))} />
        </div>
      ))}
      <button type="button" className="text-sm font-semibold text-teal" onClick={() => setLines((current) => [...current, { mpn: "", manufacturer: "", description: "", qty: 1 }])}>
        Add a line
      </button>
      <button
        className={primaryBtn}
        type="button"
        onClick={async () => {
          const result = await saveRfq({ title, notes, lines });
          if ("error" in result && result.error) setMessage(result.error);
          else if ("id" in result && result.id) router.push(`/buyer/rfqs/${result.id}`);
        }}
      >
        Send RFQ
      </button>
      {message ? <p className="text-sm text-bad">{message}</p> : null}
    </div>
  );
}

const SAMPLE_STOCK = `MPN,Manufacturer,Description,Category,Package,Qty,MOQ,GST,Lead time,Date code,City,State,Rate
STM32F103C8T6,STMicroelectronics,Cortex-M3 MCU,microcontrollers,LQFP-48,120,10,extra,Ready stock,2516,Ahmedabad,Gujarat,180
,Yageo,Missing MPN,passives,0402,10,1,extra,Ready stock,2516,Ahmedabad,Gujarat,1
RC0402FR-0710KL,Yageo,10k resistor,passives,0402,1000,100,inclusive,Ready stock,2516,Ahmedabad,Gujarat,0.2
`;

const SAMPLE_BOM = `MPN,Manufacturer,Description,Qty,Refdes,Package
STM32F103C8T6,STMicroelectronics,MCU,2,U1,LQFP-48
CUSTOM-CONN-9PIN,Local fab,Connector,1,J1,
`;
