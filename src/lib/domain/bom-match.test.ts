import { describe, expect, it } from "vitest";
import { createDemoRepo } from "@/lib/data/demo-repo";
import { createSeedStore } from "@/lib/demo/seed";
import { diffBomLines, matchBomLines } from "./bom-match";
import type { BomLine } from "./types";

const NOW = new Date("2026-10-31T00:00:00Z");

describe("BOM matching", () => {
  it("matches exact MPNs, then fuzzy MPNs, and leaves unknown lines unmatched", () => {
    const store = createSeedStore(NOW);
    const lines: BomLine[] = [
      { id: "a", revisionId: "r", lineNo: 1, mpn: "stm32f103c8t6", manufacturer: "", description: "", qty: 1, refdes: "U1", package: "" },
      { id: "b", revisionId: "r", lineNo: 2, mpn: "STM32F103C8T6-TR", manufacturer: "ST", description: "", qty: 1, refdes: "U2", package: "" },
      { id: "c", revisionId: "r", lineNo: 3, mpn: "CUSTOM-CONN-9PIN", manufacturer: "", description: "", qty: 1, refdes: "J1", package: "" },
      { id: "d", revisionId: "r", lineNo: 4, mpn: "NE555P", manufacturer: "TI", description: "stale", qty: 1, refdes: "U9", package: "" },
    ];
    const matches = matchBomLines(lines, store.listings, NOW);
    expect(matches[0]?.type).toBe("exact");
    expect(matches[0]?.listing?.mpn).toBe("STM32F103C8T6");
    expect(matches[0]?.listing && "priceBreaks" in matches[0].listing).toBe(false);
    expect(JSON.stringify(matches[0])).not.toContain("sup_mehta");
    expect(matches[0]?.alternates.length).toBeGreaterThan(0);
    expect(matches[1]?.type).toBe("fuzzy");
    expect(matches[1]?.listing?.mpn).toBe("STM32F103C8T6");
    expect(matches[2]?.type).toBe("none");
    expect(matches[3]?.type).toBe("none");
  });

  it("diffs revisions by added, removed, and quantity changes", async () => {
    const store = createSeedStore(NOW);
    const repo = createDemoRepo(store, () => NOW);
    const detail = await repo.bomDetail("buy_asha", "bom_gate", "rev_gate_r2", "rev_gate_r1");
    expect(detail?.revision.label).toBe("R2");
    const changes = new Map((detail?.diff ?? []).map((row) => [row.mpn, row.change]));
    expect(changes.get("STM32G474RET6")).toBe("added");
    expect(changes.get("ESP32-WROOM-32E")).toBe("added");
    expect(changes.get("CUSTOM-CONN-9PIN")).toBe("removed");
    expect(changes.get("AMS1117-3.3")).toBe("qty");
    expect(changes.get("BSS138")).toBe("same");
    const raw = diffBomLines(
      store.bomLines.filter((row) => row.revisionId === "rev_gate_r1"),
      store.bomLines.filter((row) => row.revisionId === "rev_gate_r2"),
    );
    expect(raw.find((row) => row.mpn === "AMS1117-3.3")).toMatchObject({ qtyA: 2, qtyB: 3, change: "qty" });
  });

  it("marks unmatched lines and exact stock on the seeded gate-driver BOM", async () => {
    const repo = createDemoRepo(createSeedStore(NOW), () => NOW);
    const detail = await repo.bomDetail("buy_asha", "bom_gate", "rev_gate_r1");
    const byMpn = new Map(detail?.lines.map((line) => [line.mpn, line.match.type]));
    expect(byMpn.get("STM32F103C8T6")).toBe("exact");
    expect(byMpn.get("NW-LDO-33")).toBe("exact");
    expect(byMpn.get("CUSTOM-CONN-9PIN")).toBe("none");
  });
});
