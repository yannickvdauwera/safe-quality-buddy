export type RiskAnalysisType = "werkpost" | "tra" | "lmra" | "rie";
export type RiskAnalysisStatus = "draft" | "published" | "archived";
export type RiskMeasureType = "technical" | "organizational" | "human";
export type RiskSessionStatus = "planned" | "in_progress" | "completed" | "cancelled";
export type RiskSignMethod = "kiosk" | "qr" | "login";

export const TYPE_LABELS: Record<RiskAnalysisType, string> = {
  werkpost: "Werkpostanalyse",
  tra: "Taakrisicoanalyse (TRA)",
  lmra: "LMRA",
  rie: "Risico-inventarisatie (RIE)",
};

export const STATUS_LABELS: Record<RiskAnalysisStatus, string> = {
  draft: "Concept",
  published: "Gepubliceerd",
  archived: "Gearchiveerd",
};

export const MEASURE_TYPE_LABELS: Record<RiskMeasureType, string> = {
  technical: "Technisch",
  organizational: "Organisatorisch",
  human: "Mensgericht",
};

export const SESSION_STATUS_LABELS: Record<RiskSessionStatus, string> = {
  planned: "Gepland",
  in_progress: "Bezig",
  completed: "Afgesloten",
  cancelled: "Geannuleerd",
};

// Fine & Kinney classification of R (= W × B × E)
export type RiskLevel = "very_low" | "low" | "medium" | "high" | "very_high";

export const RISK_LEVELS: Record<RiskLevel, { label: string; min: number; max: number; color: string; badgeClass: string }> = {
  very_low: { label: "Zeer beperkt", min: 0, max: 20, color: "#16a34a", badgeClass: "bg-green-100 text-green-800 border-green-300" },
  low: { label: "Aanvaardbaar", min: 20, max: 70, color: "#65a30d", badgeClass: "bg-lime-100 text-lime-800 border-lime-300" },
  medium: { label: "Aandacht vereist", min: 70, max: 200, color: "#eab308", badgeClass: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  high: { label: "Beheersing nodig", min: 200, max: 400, color: "#ea580c", badgeClass: "bg-orange-100 text-orange-800 border-orange-300" },
  very_high: { label: "Onaanvaardbaar", min: 400, max: Infinity, color: "#dc2626", badgeClass: "bg-red-100 text-red-800 border-red-300" },
};

export function classifyRisk(r: number | null | undefined): RiskLevel | null {
  if (r == null || Number.isNaN(r)) return null;
  if (r < 20) return "very_low";
  if (r < 70) return "low";
  if (r < 200) return "medium";
  if (r < 400) return "high";
  return "very_high";
}

export function computeR(w: number | null, b: number | null, e: number | null): number | null {
  if (w == null || b == null || e == null) return null;
  return Math.round(w * b * e * 100) / 100;
}

// Fine & Kinney standard scale values (for select inputs)
export const W_SCALE = [
  { value: 10, label: "10 — Voorspelbaar" },
  { value: 6, label: "6 — Zeer waarschijnlijk" },
  { value: 3, label: "3 — Ongewoon" },
  { value: 1, label: "1 — Onwaarschijnlijk" },
  { value: 0.5, label: "0,5 — Denkbaar" },
  { value: 0.2, label: "0,2 — Praktisch onmogelijk" },
  { value: 0.1, label: "0,1 — Vrijwel onmogelijk" },
];
export const B_SCALE = [
  { value: 10, label: "10 — Voortdurend" },
  { value: 6, label: "6 — Dagelijks" },
  { value: 3, label: "3 — Wekelijks" },
  { value: 2, label: "2 — Maandelijks" },
  { value: 1, label: "1 — Enkele keren per jaar" },
  { value: 0.5, label: "0,5 — Zelden" },
];
export const E_SCALE = [
  { value: 100, label: "100 — Catastrofaal (meerdere doden)" },
  { value: 40, label: "40 — Ramp (1 dode)" },
  { value: 15, label: "15 — Zeer ernstig (invaliditeit)" },
  { value: 7, label: "7 — Ernstig (letsel + verzuim)" },
  { value: 3, label: "3 — Belangrijk (EHBO)" },
  { value: 1, label: "1 — Gering (geen letsel)" },
];
