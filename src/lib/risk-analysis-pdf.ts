import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import tsaLogoUrl from "@/assets/tsa-logo.png";
import {
  METHOD_LABELS, MEASURE_TYPE_LABELS, TYPE_LABELS, STATUS_LABELS,
  classifyRiskFor, levelsFor, highRiskThreshold,
  type RiskMethod, type RiskAnalysisType, type RiskAnalysisStatus, type RiskMeasureType,
} from "./risk-analysis-types";

const TSA_RED: [number, number, number] = [227, 6, 19];
const TSA_DARK: [number, number, number] = [26, 26, 26];
const TSA_LIGHT: [number, number, number] = [245, 245, 247];

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

const nowStamp = () =>
  new Date().toLocaleString("nl-BE", { dateStyle: "long", timeStyle: "short" });

async function loadImage(url: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const dataUrl: string = await new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.readAsDataURL(blob);
  });
  const dims = await new Promise<{ width: number; height: number }>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.src = dataUrl;
  });
  return { dataUrl, ...dims };
}

export interface RiskAnalysisExportItem {
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

export interface RiskAnalysisExport {
  id: string;
  title: string;
  description: string | null;
  analysis_type: RiskAnalysisType;
  status: RiskAnalysisStatus;
  workpost: string | null;
  department: string | null;
  risk_method: RiskMethod;
  current_version: number;
  version_change_notes?: string | null;
  version_published_at?: string | null;
  items: RiskAnalysisExportItem[];
}

export async function exportRiskAnalysisToPdf(a: RiskAnalysisExport) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const logo = await loadImage(tsaLogoUrl).catch(() => null);

  const drawHeader = () => {
    doc.setFillColor(...TSA_RED);
    doc.rect(0, 0, pageW, 22, "F");
    doc.setFillColor(...TSA_DARK);
    doc.rect(0, 22, pageW, 2, "F");
    if (logo) {
      const h = 14;
      const w = (logo.width / logo.height) * h;
      doc.addImage(logo.dataUrl, "PNG", 12, 4, w, h);
    }
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("RISICOANALYSE", pageW - 12, 12, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("TSA Safety Services", pageW - 12, 18, { align: "right" });
  };

  const drawFooter = (page: number, total: number) => {
    doc.setDrawColor(...TSA_RED);
    doc.setLineWidth(0.6);
    doc.line(12, pageH - 14, pageW - 12, pageH - 14);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.setFont("helvetica", "normal");
    doc.text("TSA Safety Services  •  tsa-safety.be", 12, pageH - 9);
    doc.text(`Gegenereerd ${nowStamp()}`, pageW / 2, pageH - 9, { align: "center" });
    doc.text(`Pagina ${page} / ${total}`, pageW - 12, pageH - 9, { align: "right" });
  };

  drawHeader();

  // Title block
  let y = 32;
  doc.setTextColor(...TSA_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(a.title, 12, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  const metaBits = [
    TYPE_LABELS[a.analysis_type],
    STATUS_LABELS[a.status],
    `Versie ${a.current_version}`,
    a.workpost ? `Werkpost: ${a.workpost}` : null,
    a.department ? `Afdeling: ${a.department}` : null,
    a.version_published_at ? `Gepubliceerd: ${new Date(a.version_published_at).toLocaleDateString("nl-BE")}` : null,
  ].filter(Boolean).join("  •  ");
  doc.text(metaBits, 12, y);
  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`Methodiek: ${METHOD_LABELS[a.risk_method]}`, 12, y);
  y += 6;

  if (a.description) {
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    const wrapped = doc.splitTextToSize(a.description, pageW - 24);
    doc.text(wrapped, 12, y);
    y += wrapped.length * 4 + 2;
  }

  // Stats strip
  const threshold = highRiskThreshold(a.risk_method);
  const grossHigh = a.items.filter((i) => (i.score_r ?? 0) >= threshold).length;
  const netHigh = a.items.filter((i) => (i.residual_r ?? 0) >= threshold).length;
  const avgReduction = a.items.length
    ? Math.round(
        a.items.reduce((s, i) => (i.score_r && i.residual_r ? s + ((i.score_r - i.residual_r) / i.score_r) * 100 : s), 0) /
          a.items.length,
      )
    : 0;

  autoTable(doc, {
    startY: y,
    head: [["Totaal items", `Bruto R ≥ ${threshold}`, `Netto R ≥ ${threshold}`, "Gem. risicoreductie"]],
    body: [[String(a.items.length), String(grossHigh), String(netHigh), `${avgReduction}%`]],
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 3, halign: "center", textColor: TSA_DARK, lineColor: [229, 229, 229], lineWidth: 0.1 },
    headStyles: { fillColor: TSA_DARK, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
    margin: { left: 12, right: 12 },
  });
  // @ts-expect-error jspdf-autotable augments doc
  y = (doc.lastAutoTable?.finalY ?? y) + 6;

  const isKE = a.risk_method === "kans_ernst";
  const scoreLabel = (w: number | null, b: number | null, e: number | null) =>
    isKE ? `K${w ?? "—"} · E${e ?? "—"}` : `W${w ?? "—"} · B${b ?? "—"} · E${e ?? "—"}`;

  const levelCfg = (r: number | null | undefined) => {
    const lvl = classifyRiskFor(a.risk_method, r);
    return lvl ? levelsFor(a.risk_method)[lvl] : null;
  };

  const body = a.items.map((it) => [
    String(it.position),
    [it.activity, it.hazard, it.risk_description ? `Kans op: ${it.risk_description}` : null].filter(Boolean).join("\n"),
    `${it.score_r ?? "—"}\n${scoreLabel(it.score_w, it.score_b, it.score_e)}`,
    [it.measures ?? "", it.measure_types.length ? `[${it.measure_types.map((m) => MEASURE_TYPE_LABELS[m]).join(", ")}]` : ""]
      .filter(Boolean).join("\n"),
    `${it.residual_r ?? "—"}\n${scoreLabel(it.residual_w, it.residual_b, it.residual_e)}`,
  ]);

  autoTable(doc, {
    startY: y,
    head: [["#", "Activiteit / Gevaar", "Bruto R", "Beheersmaatregelen", "Netto R"]],
    body,
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 2.5, lineColor: [229, 229, 229], lineWidth: 0.1, textColor: TSA_DARK, valign: "top" },
    headStyles: { fillColor: TSA_DARK, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9, halign: "left" },
    alternateRowStyles: { fillColor: TSA_LIGHT },
    columnStyles: {
      0: { cellWidth: 10, halign: "center", fontStyle: "bold" },
      1: { cellWidth: 75 },
      2: { cellWidth: 32, halign: "center", fontStyle: "bold" },
      3: { cellWidth: "auto" },
      4: { cellWidth: 32, halign: "center", fontStyle: "bold" },
    },
    margin: { left: 12, right: 12, top: 28, bottom: 20 },
    didDrawPage: () => drawHeader(),
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const item = a.items[data.row.index];
      if (data.column.index === 2) {
        const cfg = levelCfg(item.score_r);
        if (cfg) {
          data.cell.styles.fillColor = hexToRgb(cfg.color);
          data.cell.styles.textColor = [255, 255, 255];
        }
      }
      if (data.column.index === 4) {
        const cfg = levelCfg(item.residual_r);
        if (cfg) {
          data.cell.styles.fillColor = hexToRgb(cfg.color);
          data.cell.styles.textColor = [255, 255, 255];
        }
      }
    },
  });

  // Legend
  // @ts-expect-error jspdf-autotable augments doc
  let ly = (doc.lastAutoTable?.finalY ?? y) + 6;
  const levels = levelsFor(a.risk_method);
  const entries = Object.values(levels);
  if (ly > pageH - 30) {
    doc.addPage();
    drawHeader();
    ly = 32;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...TSA_DARK);
  doc.text("Risicoclassificatie", 12, ly);
  ly += 4;
  autoTable(doc, {
    startY: ly,
    head: [["Niveau", "Van", "Tot"]],
    body: entries.map((e) => [e.label, String(e.min), e.max === Infinity ? "∞" : String(e.max)]),
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2, lineColor: [229, 229, 229], lineWidth: 0.1, textColor: TSA_DARK },
    headStyles: { fillColor: TSA_DARK, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    columnStyles: { 0: { cellWidth: 50, fontStyle: "bold" }, 1: { cellWidth: 20, halign: "center" }, 2: { cellWidth: 20, halign: "center" } },
    margin: { left: 12, right: 12 },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 0) {
        const cfg = entries[data.row.index];
        data.cell.styles.fillColor = hexToRgb(cfg.color);
        data.cell.styles.textColor = [255, 255, 255];
      }
    },
  });

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawFooter(i, total);
  }

  const safeName = a.title.replace(/[^a-z0-9]+/gi, "_").slice(0, 40);
  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`TSA_RA_${safeName}_v${a.current_version}_${dateStr}.pdf`);
}
