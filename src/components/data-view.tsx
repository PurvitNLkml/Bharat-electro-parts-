"use client";

import { QuoteButton } from "@/components/quote-button";
import { copy } from "@/lib/i18n";
import { resolveFlag, setSupplierStatus, touchListing } from "@/server/actions";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ghostBtn, primaryBtn } from "./ui";
import "jspreadsheet-ce/dist/jspreadsheet.css";
import "jsuites/dist/jsuites.css";

export type GridColumn = {
  key: string;
  title: string;
  width?: number;
  kind?: "text" | "number";
};

export type GridRow = Record<string, string | number | boolean | null>;

type SavedView = {
  name: string;
  query: string;
  sortKey: string;
  sortDir: "asc" | "desc";
  hidden: string[];
};

type RowAction = "quote" | "touch" | "verify" | "resolve" | { open: string };

function RowActions({ action, row }: { action?: RowAction; row: GridRow }) {
  if (action === "quote") {
    return <QuoteButton mpn={String(row.mpn)} manufacturer={String(row.manufacturer ?? "")} description={String(row.description ?? "")} />;
  }
  if (action === "touch") {
    return (
      <form action={touchListing}>
        <input type="hidden" name="id" value={String(row.id)} />
        <button className="text-sm font-semibold text-teal" type="submit">{copy.supplier.fresh}</button>
      </form>
    );
  }
  if (action === "verify") {
    return (
      <div className="flex flex-wrap gap-2">
        <form action={setSupplierStatus}>
          <input type="hidden" name="supplierId" value={String(row.id)} />
          <input type="hidden" name="status" value="verified" />
          <button className="text-sm font-semibold text-good" type="submit">Verify</button>
        </form>
        <form action={setSupplierStatus}>
          <input type="hidden" name="supplierId" value={String(row.id)} />
          <input type="hidden" name="status" value="rejected" />
          <button className="text-sm font-semibold text-bad" type="submit">Reject</button>
        </form>
      </div>
    );
  }
  if (action === "resolve") {
    if (row.resolved) return null;
    return (
      <form action={resolveFlag}>
        <input type="hidden" name="flagId" value={String(row.id)} />
        <button className="text-sm font-semibold text-teal" type="submit">Resolve</button>
      </form>
    );
  }
  if (action && typeof action === "object" && "open" in action) {
    return (
      <Link className="text-sm font-semibold text-teal" href={`${action.open}${row.id}`}>
        Open
      </Link>
    );
  }
  return null;
}

export function DataView({
  screen,
  columns,
  rows,
  renderCard,
  renderActions,
  rowAction,
  empty,
  editable = false,
  onRowsChange,
}: {
  screen: string;
  columns: GridColumn[];
  rows: GridRow[];
  renderCard?: (row: GridRow) => ReactNode;
  renderActions?: (row: GridRow) => ReactNode;
  rowAction?: RowAction;
  empty?: ReactNode;
  editable?: boolean;
  onRowsChange?: (rows: GridRow[]) => void;
}) {
  const [mode, setMode] = useState<"cards" | "table" | "sheet">("table");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState(columns[0]?.key ?? "");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [hidden, setHidden] = useState<string[]>([]);
  const [views, setViews] = useState<SavedView[]>([]);
  const [viewName, setViewName] = useState("");
  const host = useRef<HTMLDivElement>(null);
  const rowsRef = useRef(rows);
  const changeRef = useRef(onRowsChange);
  useEffect(() => {
    rowsRef.current = rows;
    changeRef.current = onRowsChange;
  });

  useEffect(() => {
    const storedMode = window.localStorage.getItem(`bep-mode:${screen}`);
    /* eslint-disable react-hooks/set-state-in-effect -- localStorage is read after mount */
    if (storedMode === "cards" || storedMode === "table" || storedMode === "sheet") setMode(storedMode);
    else if (window.matchMedia("(max-width: 720px)").matches) setMode("cards");
    const storedViews = window.localStorage.getItem(`bep-views:${screen}`);
    if (storedViews) {
      try {
        setViews(JSON.parse(storedViews) as SavedView[]);
      } catch {
        setViews([]);
      }
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [screen]);

  const visibleColumns = useMemo(() => columns.filter((column) => !hidden.includes(column.key)), [columns, hidden]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const next = rows.filter((row) => {
      if (!needle) return true;
      return visibleColumns.some((column) => String(row[column.key] ?? "").toLowerCase().includes(needle));
    });
    next.sort((a, b) => {
      const left = a[sortKey];
      const right = b[sortKey];
      const compared = typeof left === "number" && typeof right === "number" ? left - right : String(left ?? "").localeCompare(String(right ?? ""));
      return sortDir === "asc" ? compared : -compared;
    });
    return next;
  }, [query, rows, sortDir, sortKey, visibleColumns]);

  const columnKey = visibleColumns.map((column) => column.key).join("|");
  const sheetDataKey = editable ? "editable" : JSON.stringify(filtered);
  useEffect(() => {
    if (mode !== "sheet" || !host.current) return;
    const el = host.current;
    let dead = false;
    const source = editable ? rowsRef.current : filtered;
    const data = source.map((row) => visibleColumns.map((column) => row[column.key] ?? ""));
    void import("jspreadsheet-ce").then((mod) => {
      if (dead) return;
      el.innerHTML = "";
      const jspreadsheet = mod.default;
      const options: Record<string, unknown> = {
        data: data.length ? data : [visibleColumns.map(() => "")],
        columns: visibleColumns.map((column) => ({
          title: column.title,
          width: column.width ?? 140,
          type: column.kind === "number" ? "numeric" : "text",
          readOnly: !editable,
        })),
        columnSorting: true,
        search: true,
        tableOverflow: true,
        tableWidth: "100%",
        tableHeight: "460px",
        allowInsertRow: editable,
        allowManualInsertColumn: false,
        allowDeleteColumn: false,
        parseFormulas: false,
        onchange: () => sync(),
        oninsertrow: () => sync(),
        ondeleterow: () => sync(),
      };
      try {
        jspreadsheet(el, { ...options, filters: true });
      } catch {
        el.innerHTML = "";
        jspreadsheet(el, options);
      }
      function sync() {
        if (!editable || !changeRef.current) return;
        const table = el.querySelector("table.jexcel");
        if (!table) return;
        const body = [...table.querySelectorAll("tbody tr")].map((tr) => {
          const cells = [...tr.querySelectorAll("td")].slice(1);
          const next: GridRow = {};
          visibleColumns.forEach((column, index) => {
            const value = cells[index]?.textContent ?? "";
            next[column.key] = column.kind === "number" ? Number(value || 0) : value;
          });
          return next;
        });
        changeRef.current(body);
      }
    });
    return () => {
      dead = true;
      el.innerHTML = "";
    };
    // Sheet data is snapshotted when the view, columns, or report rows change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnKey, editable, mode, sheetDataKey]);

  function choose(next: "cards" | "table" | "sheet") {
    setMode(next);
    window.localStorage.setItem(`bep-mode:${screen}`, next);
  }

  function saveView() {
    const name = viewName.trim();
    if (!name) return;
    const next = [...views.filter((view) => view.name !== name), { name, query, sortKey, sortDir, hidden }];
    setViews(next);
    window.localStorage.setItem(`bep-views:${screen}`, JSON.stringify(next));
    setViewName("");
  }

  async function exportFile(kind: "csv" | "xlsx") {
    const XLSX = await import("xlsx");
    const sheetRows = filtered.map((row) => {
      const record: Record<string, string | number | boolean | null> = {};
      for (const column of visibleColumns) record[column.title] = row[column.key];
      return record;
    });
    const sheet = XLSX.utils.json_to_sheet(sheetRows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "BharatElectroParts");
    XLSX.writeFile(book, `${screen}.${kind === "csv" ? "csv" : "xlsx"}`);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(["cards", "table", "sheet"] as const).map((item) => (
          <button key={item} type="button" className={mode === item ? primaryBtn : ghostBtn} onClick={() => choose(item)}>
            {copy.grid[item]}
          </button>
        ))}
        <input className="min-h-11 min-w-40 flex-1 rounded-full border border-line bg-white px-4 text-sm" placeholder={copy.grid.filter} value={query} onChange={(event) => setQuery(event.target.value)} />
        <select className="min-h-11 rounded-full border border-line bg-white px-3 text-sm" value={sortKey} onChange={(event) => setSortKey(event.target.value)}>
          {columns.map((column) => (
            <option key={column.key} value={column.key}>
              {copy.grid.sort}: {column.title}
            </option>
          ))}
        </select>
        <button type="button" className={ghostBtn} onClick={() => setSortDir((dir) => (dir === "asc" ? "desc" : "asc"))}>
          {sortDir === "asc" ? "A–Z" : "Z–A"}
        </button>
        <button type="button" className={ghostBtn} onClick={() => void exportFile("csv")}>
          {copy.grid.csv}
        </button>
        <button type="button" className={ghostBtn} onClick={() => void exportFile("xlsx")}>
          {copy.grid.excel}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input className="min-h-11 rounded-full border border-line bg-white px-4 text-sm" placeholder={copy.grid.viewName} value={viewName} onChange={(event) => setViewName(event.target.value)} />
        <button type="button" className={ghostBtn} onClick={saveView}>
          {copy.grid.save}
        </button>
        <select
          className="min-h-11 rounded-full border border-line bg-white px-3 text-sm"
          defaultValue=""
          onChange={(event) => {
            const view = views.find((item) => item.name === event.target.value);
            if (!view) return;
            setQuery(view.query);
            setSortKey(view.sortKey);
            setSortDir(view.sortDir);
            setHidden(view.hidden);
          }}
        >
          <option value="">Saved views</option>
          {views.map((view) => (
            <option key={view.name} value={view.name}>
              {view.name}
            </option>
          ))}
        </select>
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold">Columns</summary>
          <div className="mt-2 flex flex-wrap gap-3">
            {columns.map((column) => (
              <label key={column.key} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={!hidden.includes(column.key)}
                  onChange={(event) =>
                    setHidden((current) => (event.target.checked ? current.filter((key) => key !== column.key) : [...current, column.key]))
                  }
                />
                {column.title}
              </label>
            ))}
          </div>
        </details>
      </div>
      <p className="text-sm text-ink-soft">{copy.grid.local}</p>
      {mode === "sheet" ? <p className="text-sm text-ink-soft md:hidden">{copy.grid.swipe}</p> : null}
      {filtered.length === 0 && mode !== "sheet" ? <div className="rounded-2xl border border-dashed border-line bg-card p-6 text-ink-soft">{empty ?? "Nothing in this list."}</div> : null}
      {mode === "cards" ? (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((row, index) => (
            <article key={index} className="rounded-2xl border border-line bg-card p-4">
              {renderCard ? renderCard(row) : (
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  {visibleColumns.map((column) => (
                    <div key={column.key}>
                      <dt className="text-ink-soft">{column.title}</dt>
                      <dd className="font-medium">{String(row[column.key] ?? "")}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {renderActions ? <div className="mt-3">{renderActions(row)}</div> : <div className="mt-3"><RowActions action={rowAction} row={row} /></div>}
            </article>
          ))}
        </div>
      ) : null}
      {mode === "table" ? (
        <div className="overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-paper text-ink-soft">
              <tr>
                {visibleColumns.map((column) => (
                  <th key={column.key} className="px-3 py-2 font-semibold">
                    <button type="button" onClick={() => { setSortKey(column.key); setSortDir((dir) => (sortKey === column.key && dir === "asc" ? "desc" : "asc")); }}>
                      {column.title}
                    </button>
                  </th>
                ))}
                {renderActions || rowAction ? <th className="px-3 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, index) => (
                <tr key={index} className="border-t border-line">
                  {visibleColumns.map((column) => (
                    <td key={column.key} className={`px-3 py-2 ${column.key === "mpn" ? "font-mono" : ""}`}>
                      {String(row[column.key] ?? "")}
                    </td>
                  ))}
                  {renderActions || rowAction ? <td className="px-3 py-2">{renderActions ? renderActions(row) : <RowActions action={rowAction} row={row} />}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {mode === "sheet" ? <div ref={host} className="sheet-host" /> : null}
    </div>
  );
}
