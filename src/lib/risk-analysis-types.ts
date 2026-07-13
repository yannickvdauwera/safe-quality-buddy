export type RiskAnalysisType = "werkpost" | "tra" | "organisatie" | "lmra" | "rie";
export type RiskAnalysisStatus = "draft" | "published" | "archived";
export type RiskMeasureType = "technical" | "organizational" | "human";
export type RiskSessionStatus = "planned" | "in_progress" | "completed" | "cancelled";
export type RiskSignMethod = "kiosk" | "qr" | "login";
export type RiskMethod = "fine_kinney" | "kans_ernst";

// ============ Organisatie-analyse ============
// Aparte indeling per thema, met smiley i.p.v. numerieke score.

export type OrgTheme = "ALG" | "AVB" | "GEZ" | "PSY" | "ABH";
export const ORG_THEMES: OrgTheme[] = ["ALG", "AVB", "GEZ", "PSY", "ABH"];
export const ORG_THEME_LABELS: Record<OrgTheme, string> = {
  ALG: "Algemeen",
  AVB: "Arbeidsveiligheid",
  GEZ: "Gezondheid",
  PSY: "Psychosociaal",
  ABH: "Arbeidshygiëne",
};
export const ORG_THEME_COLORS: Record<OrgTheme, string> = {
  ALG: "#64748b",
  AVB: "#dc2626",
  GEZ: "#059669",
  PSY: "#7c3aed",
  ABH: "#0891b2",
};

export type Smiley = "green" | "yellow" | "red";
export const SMILEY_META: Record<Smiley, { label: string; emoji: string; color: string; badgeClass: string }> = {
  green: { label: "In orde", emoji: "🙂", color: "#16a34a", badgeClass: "bg-green-100 text-green-800 border-green-300" },
  yellow: { label: "Aandacht", emoji: "😐", color: "#eab308", badgeClass: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  red: { label: "Niet in orde", emoji: "🙁", color: "#dc2626", badgeClass: "bg-red-100 text-red-800 border-red-300" },
};

export type MeasureStatus = "open" | "in_progress" | "done";
export const MEASURE_STATUS_LABELS: Record<MeasureStatus, string> = {
  open: "Open",
  in_progress: "In uitvoering",
  done: "Afgerond",
};
export const MEASURE_STATUS_META: Record<MeasureStatus, { label: string; badgeClass: string }> = {
  open: { label: "Open", badgeClass: "bg-slate-100 text-slate-800 border-slate-300" },
  in_progress: { label: "In uitvoering", badgeClass: "bg-blue-100 text-blue-800 border-blue-300" },
  done: { label: "Afgerond", badgeClass: "bg-green-100 text-green-800 border-green-300" },
};

export const METHOD_LABELS: Record<RiskMethod, string> = {
  fine_kinney: "Fine & Kinney (W × B × E)",
  kans_ernst: "Kans × Ernst (5 × 5)",
};

export const TYPE_LABELS: Record<RiskAnalysisType, string> = {
  werkpost: "Werkpostanalyse",
  tra: "Taakrisicoanalyse (TRA)",
  organisatie: "Risicoanalyse organisatie",
  lmra: "LMRA (verouderd)",
  rie: "Risico-inventarisatie (verouderd)",
};

// Types die actief geselecteerd kunnen worden bij nieuwe/gewijzigde analyses.
// LMRA en RIE zijn uitgefaseerd: bestaande records blijven leesbaar via TYPE_LABELS,
// maar zijn niet meer aan te maken of te kiezen bij wijzigen.
export const SELECTABLE_TYPES: RiskAnalysisType[] = ["werkpost", "tra", "organisatie"];

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

// Volgorde en visuele styling voor de drie types risicoreductie.
// Deze volgorde weerspiegelt de arbeidshygiënische strategie: technisch vóór
// organisatorisch vóór mensgericht (PBM/instructies als laatste vangnet).
export const MEASURE_TYPE_ORDER: RiskMeasureType[] = ["technical", "organizational", "human"];

export const MEASURE_TYPE_META: Record<RiskMeasureType, {
  label: string;
  short: string;
  hint: string;
  badgeClass: string;
  swatch: string;
}> = {
  technical: {
    label: "Technisch",
    short: "T",
    hint: "Bronmaatregelen: hardware, afscherming, ventilatie, veiliger materieel.",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-300",
    swatch: "#2563eb",
  },
  organizational: {
    label: "Organisatorisch",
    short: "O",
    hint: "Procedures, werkvergunningen, planning, toezicht, taakverdeling.",
    badgeClass: "bg-purple-100 text-purple-800 border-purple-300",
    swatch: "#7c3aed",
  },
  human: {
    label: "Mensgericht",
    short: "M",
    hint: "PBM, opleiding, instructie, toolbox — laatste vangnet.",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
    swatch: "#d97706",
  },
};

export type MeasuresByType = Partial<Record<RiskMeasureType, string>>;

// Maatregelen worden per type opgeslagen als JSON in het bestaande `measures` tekstveld.
// Legacy items (vóór deze splitsing) staan als vrije tekst en worden in `legacy` teruggegeven.
export function parseMeasures(raw: string | null | undefined): { byType: MeasuresByType; legacy?: string } {
  if (!raw) return { byType: {} };
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (parsed && typeof parsed === "object") {
        const out: MeasuresByType = {};
        for (const k of MEASURE_TYPE_ORDER) {
          const v = parsed[k];
          if (typeof v === "string" && v.trim()) out[k] = v;
        }
        return { byType: out };
      }
    } catch {
      // fall through to legacy
    }
  }
  return { byType: {}, legacy: raw };
}

export function serializeMeasures(m: MeasuresByType): string | null {
  const cleaned: MeasuresByType = {};
  for (const k of MEASURE_TYPE_ORDER) {
    const v = m[k]?.trim();
    if (v) cleaned[k] = v;
  }
  return Object.keys(cleaned).length ? JSON.stringify(cleaned) : null;
}

export function measureTypesFrom(m: MeasuresByType): RiskMeasureType[] {
  return MEASURE_TYPE_ORDER.filter((k) => (m[k] ?? "").trim().length > 0);
}

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

// ============ Kans × Ernst (5×5) ============
// Score = K × E, waarbij K ∈ 1..5 en E ∈ 1..5, R ∈ 1..25.
// K wordt opgeslagen in score_w, E in score_e, R in score_r (score_b blijft null).

export const K_SCALE = [
  { value: 5, label: "5 — Zeer waarschijnlijk / vaak" },
  { value: 4, label: "4 — Waarschijnlijk" },
  { value: 3, label: "3 — Mogelijk" },
  { value: 2, label: "2 — Onwaarschijnlijk" },
  { value: 1, label: "1 — Zeer onwaarschijnlijk" },
];

export const E5_SCALE = [
  { value: 5, label: "5 — Catastrofaal (dodelijk)" },
  { value: 4, label: "4 — Zeer ernstig (blijvend letsel)" },
  { value: 3, label: "3 — Ernstig (verzuim)" },
  { value: 2, label: "2 — Beperkt (EHBO)" },
  { value: 1, label: "1 — Verwaarloosbaar" },
];

// TSA-matrix (5×5): laag 1-4 (groen), gemiddeld 5-12 (geel), hoog 15-25 (rood)
export const RISK_LEVELS_KE: Record<RiskLevel, { label: string; min: number; max: number; color: string; badgeClass: string }> = {
  very_low: { label: "Laag", min: 1, max: 5, color: "#16a34a", badgeClass: "bg-green-100 text-green-800 border-green-300" },
  low: { label: "Laag", min: 1, max: 5, color: "#16a34a", badgeClass: "bg-green-100 text-green-800 border-green-300" },
  medium: { label: "Gemiddeld", min: 5, max: 15, color: "#eab308", badgeClass: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  high: { label: "Hoog", min: 15, max: 26, color: "#dc2626", badgeClass: "bg-red-100 text-red-800 border-red-300" },
  very_high: { label: "Hoog", min: 15, max: 26, color: "#dc2626", badgeClass: "bg-red-100 text-red-800 border-red-300" },
};

export function classifyRiskKE(r: number | null | undefined): RiskLevel | null {
  if (r == null || Number.isNaN(r)) return null;
  if (r < 5) return "low";
  if (r < 15) return "medium";
  return "high";
}

export function computeRKE(k: number | null, e: number | null): number | null {
  if (k == null || e == null) return null;
  return k * e;
}

// Method-agnostic helpers — pick the right formula/classificatie op basis van methode.
export function computeRFor(method: RiskMethod, w: number | null, b: number | null, e: number | null): number | null {
  return method === "kans_ernst" ? computeRKE(w, e) : computeR(w, b, e);
}

export function classifyRiskFor(method: RiskMethod, r: number | null | undefined): RiskLevel | null {
  return method === "kans_ernst" ? classifyRiskKE(r) : classifyRisk(r);
}

export function levelsFor(method: RiskMethod) {
  return method === "kans_ernst" ? RISK_LEVELS_KE : RISK_LEVELS;
}

// Drempel voor "hoog risico" per methode (gebruikt voor statistieken).
export function highRiskThreshold(method: RiskMethod): number {
  return method === "kans_ernst" ? 15 : 200;
}

