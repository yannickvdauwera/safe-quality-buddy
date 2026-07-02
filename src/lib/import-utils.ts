import * as XLSX from "xlsx";

/** Read the first sheet of an xlsx file into an array-of-arrays (raw cells). */
export async function readSheetAsMatrix(file: File): Promise<unknown[][]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true });
}

/** Find the header row by locating a row that contains the given probe string (case-insensitive). */
export function findHeaderRow(matrix: unknown[][], probe: string): number {
  const p = probe.toLowerCase();
  for (let i = 0; i < Math.min(matrix.length, 20); i++) {
    if (matrix[i]?.some((c) => typeof c === "string" && c.toLowerCase().includes(p))) return i;
  }
  return 0;
}

/** Turn a matrix into records using the given header row. */
export function matrixToRecords(matrix: unknown[][], headerRow: number): Record<string, unknown>[] {
  const headers = (matrix[headerRow] ?? []).map((h) => (h == null ? "" : String(h).trim()));
  const rows: Record<string, unknown>[] = [];
  for (let i = headerRow + 1; i < matrix.length; i++) {
    const r = matrix[i] ?? [];
    if (r.every((c) => c == null || String(c).trim() === "")) continue;
    const obj: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      if (h) obj[h] = r[idx] ?? null;
    });
    // skip if all mapped values are empty
    if (Object.values(obj).every((v) => v == null || String(v).trim() === "")) continue;
    rows.push(obj);
  }
  return rows;
}

/** Normalize a name for fuzzy matching: lowercase, strip diacritics, collapse whitespace. */
export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Return the set of "tokens" of a name so "Jan Peeters" matches "Peeters Jan". */
export function nameKey(s: string): string {
  return normalizeName(s).split(" ").filter(Boolean).sort().join(" ");
}

/** Split "Voornaam Achternaam" or "Achternaam Voornaam" heuristically. */
export function splitFullName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  // Heuristic: if the first token looks like ALL-CAPS or is fully uppercase, treat as last name.
  const first = parts[0];
  const rest = parts.slice(1).join(" ");
  if (first === first.toUpperCase() && first.length > 1) {
    return { first: rest, last: first };
  }
  // Default: last token is last name, everything before is first name(s).
  return {
    first: parts.slice(0, -1).join(" "),
    last: parts[parts.length - 1],
  };
}

/** Parse an Excel serial or ISO/date string to an ISO timestamp (or null). */
export function parseDateCell(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    const jsD = new Date(Date.UTC(d.y, (d.m ?? 1) - 1, d.d ?? 1, d.H ?? 0, d.M ?? 0, Math.floor(d.S ?? 0)));
    return jsD.toISOString();
  }
  const s = String(v).trim();
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export function cellString(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}
