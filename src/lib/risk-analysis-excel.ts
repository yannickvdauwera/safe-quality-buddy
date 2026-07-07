import * as XLSX from "xlsx";
import type { RiskAnalysisType, RiskMeasureType } from "./risk-analysis-types";

export interface ParsedRiskItem {
  position: number;
  activity: string | null;
  hazard: string;
  risk_description: string | null;
  score_w: number | null;
  score_b: number | null;
  score_e: number | null;
  score_r: number | null;
  measures: string | null;
  measure_types: RiskMeasureType[];
  residual_w: number | null;
  residual_b: number | null;
  residual_e: number | null;
  residual_r: number | null;
}

export interface ParsedRiskAnalysis {
  title: string;
  analysis_type: RiskAnalysisType;
  items: ParsedRiskItem[];
}

const toNum = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const toStr = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Parse a monday.com-style RA export.
 * Layout: parent row = workpost name in col A + status in col G.
 * Header row starts with "Subitems" in col A.
 * Item rows have empty col A, sequential number in col B, then columns:
 *   Activiteit | Gevarendrager/Gevaar | Risico | W | B | E | R | Risicoreductie |
 *   Technisch | Organisatorisch | Mensgericht | W' | B' | E' | R'
 */
export function parseMondayExport(fileBuffer: ArrayBuffer): ParsedRiskAnalysis[] {
  const wb = XLSX.read(fileBuffer, { type: "array" });
  const results: ParsedRiskAnalysis[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

    let currentTitle: string | null = null;
    let currentItems: ParsedRiskItem[] = [];
    let colMap: Record<string, number> | null = null;
    let position = 0;

    const flush = () => {
      if (currentTitle && currentItems.length > 0) {
        results.push({
          title: currentTitle,
          analysis_type: "werkpost",
          items: currentItems,
        });
      }
      currentTitle = null;
      currentItems = [];
      colMap = null;
      position = 0;
    };

    for (const row of rows) {
      if (!row || row.every((c) => c == null || c === "")) continue;
      const colA = toStr(row[0]);
      const colB = toStr(row[1]);

      // Header row for subitems
      if (colA && norm(colA) === "subitems" && colB && norm(colB) === "name") {
        colMap = {};
        row.forEach((h, idx) => {
          if (typeof h === "string") colMap![norm(h)] = idx;
        });
        continue;
      }

      // Parent workpost row: col A has a title, and it isn't "subitems"
      if (colA && norm(colA) !== "subitems") {
        // Detect: only accept as parent if it looks like a title (no "Name" header row)
        const isHeaderish = norm(colA) === "name" || colA.startsWith("2.1.2") || colA.startsWith("Risicoanalyses");
        if (isHeaderish) continue;
        flush();
        currentTitle = colA;
        continue;
      }

      // Item row (only if we have a header map + parent)
      if (colMap && currentTitle && colA == null) {
        const get = (key: string) => (colMap![key] != null ? row[colMap![key]] : null);
        const hazard = toStr(get("gevarendragergevaar")) ?? toStr(get("gevaar")) ?? "";
        if (!hazard) continue;
        position += 1;

        const measures = toStr(get("risicoreductie")) ?? toStr(get("maatregelen"));
        const measure_types: RiskMeasureType[] = [];
        if (toStr(get("technisch"))) measure_types.push("technical");
        if (toStr(get("organisatorisch"))) measure_types.push("organizational");
        if (toStr(get("mensgericht"))) measure_types.push("human");

        // Residual columns are labelled inconsistently (W1, B2, E3, R2 in the sample).
        // Fall back by position: the last four numeric columns after the measure columns.
        const residualKeys = ["w1", "b2", "e3", "r2", "wrest", "brest", "erest", "rrest"];
        const findAny = (candidates: string[]) => {
          for (const c of candidates) if (colMap![c] != null) return row[colMap![c]];
          return null;
        };

        currentItems.push({
          position,
          activity: toStr(get("activiteit")),
          hazard,
          risk_description: toStr(get("risicokansop")) ?? toStr(get("risico")),
          score_w: toNum(get("w")),
          score_b: toNum(get("b")),
          score_e: toNum(get("e")),
          score_r: toNum(get("r")),
          measures,
          measure_types,
          residual_w: toNum(findAny(["w1", "wrest", "wna"])),
          residual_b: toNum(findAny(["b2", "brest", "bna"])),
          residual_e: toNum(findAny(["e3", "erest", "ena"])),
          residual_r: toNum(findAny(["r2", "rrest", "rna"])),
        });
      }
    }
    flush();
  }

  return results;
}
