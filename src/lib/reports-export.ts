import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { supabase } from "@/integrations/supabase/client";
import tsaLogoUrl from "@/assets/tsa-logo.png";

export interface ReportExport {
  id: string;
  type: string;
  title: string;
  severity: string;
  status: string;
  observed_at: string;
  location: string | null;
  involved_firm: string | null;
  description: string | null;
  follow_up_notes: string | null;
  details: Record<string, unknown> | null;
  reporter_name?: string | null;
}

const TSA_RED: [number, number, number] = [227, 6, 19];
const TSA_DARK: [number, number, number] = [26, 26, 26];
const TSA_LIGHT: [number, number, number] = [245, 245, 247];

const TYPE_LABELS: Record<string, { title: string; short: string }> = {
  ao_ehbo: { title: "Arbeidsongeval / EHBO", short: "AO-EHBO" },
  klacht: { title: "Interne klacht / Kwaliteitsincident", short: "Klacht" },
  wpi: { title: "Werkplekinspectie", short: "WPI" },
  werkplekinspectie: { title: "Werkplekinspectie", short: "WPI" },
  kwaliteitscontrole: { title: "Kwaliteitscontrole", short: "KC" },
};

const label = (t: string) => TYPE_LABELS[t] ?? { title: t, short: t };

const nowStamp = () =>
  new Date().toLocaleString("nl-BE", { dateStyle: "long", timeStyle: "short" });

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("nl-BE") : "—";

async function loadLogo(): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    const res = await fetch(tsaLogoUrl);
    const blob = await res.blob();
    const dataUrl: string = await new Promise((r) => {
      const fr = new FileReader();
      fr.onload = () => r(fr.result as string);
      fr.readAsDataURL(blob);
    });
    const dims = await new Promise<{ width: number; height: number }>((r) => {
      const img = new Image();
      img.onload = () => r({ width: img.width, height: img.height });
      img.src = dataUrl;
    });
    return { dataUrl, ...dims };
  } catch {
    return null;
  }
}

function aoSections(r: ReportExport): Array<{ title: string; rows: Array<[string, string]> }> {
  const d = (r.details ?? {}) as Record<string, string | undefined>;
  return [
    {
      title: "Referentie & status",
      rows: [
        ["Referentie", r.id.slice(0, 8).toUpperCase()],
        ["Titel", r.title],
        ["Ernst", r.severity],
        ["Status", r.status],
        ["Type incident", d.incident_type ?? "—"],
      ],
    },
    {
      title: "Datum & locatie",
      rows: [
        ["Datum incident", fmtDate(d.incident_date || r.observed_at)],
        ["Locatie", r.location ?? "—"],
        ["Betrokken firma", r.involved_firm ?? "—"],
      ],
    },
    {
      title: "Slachtoffer & hulpverlener",
      rows: [
        ["Slachtoffernaam", d.victim_name ?? "—"],
        ["Type contract", d.contract_type ?? "—"],
        ["Hulpverlener", d.first_aider ?? "—"],
      ],
    },
    {
      title: "Letsel",
      rows: [
        ["Lichaamsdeel", d.body_part ?? "—"],
        ["Detail lichaamsdeel", d.body_detail ?? "—"],
      ],
    },
    {
      title: "Relaas & onderzoek",
      rows: [
        ["Relaas", d.relaas ?? "—"],
        ["Ongevallenonderzoek", d.investigation ?? "—"],
        ["Opvolging", r.follow_up_notes ?? "—"],
      ],
    },
  ];
}

const humanize = (k: string) =>
  k.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const fmtValue = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Ja" : "Nee";
  if (Array.isArray(v)) return v.length ? v.map(fmtValue).join(" • ") : "—";
  if (typeof v === "object") {
    const entries = Object.entries(v as Record<string, unknown>).filter(([, val]) => val !== null && val !== undefined && val !== "");
    if (!entries.length) return "—";
    return entries.map(([k, val]) => `${humanize(k)}: ${fmtValue(val)}`).join("\n");
  }
  return String(v);
};

function flattenRows(obj: Record<string, unknown>): Array<[string, string]> {
  return Object.entries(obj)
    .filter(([, v]) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => [humanize(k), fmtValue(v)] as [string, string]);
}

function genericSections(r: ReportExport): Array<{ title: string; rows: Array<[string, string]> }> {
  const d = (r.details ?? {}) as Record<string, unknown>;
  const rows: Array<[string, string]> = [
    ["Referentie", r.id.slice(0, 8).toUpperCase()],
    ["Titel", r.title],
    ["Type", label(r.type).title],
    ["Datum", fmtDate(r.observed_at)],
    ["Locatie", r.location ?? "—"],
    ["Betrokken firma", r.involved_firm ?? "—"],
    ["Ernst", r.severity],
    ["Status", r.status],
  ];
  const out: Array<{ title: string; rows: Array<[string, string]> }> = [{ title: "Melding", rows }];

  // Unpack well-known nested groups (WPI / KC checklist form structure)
  const header = d.header as Record<string, unknown> | undefined;
  const answers = d.answers as Record<string, unknown> | undefined;
  const extras = d.extras as Record<string, unknown> | undefined;
  const stats = d.stats as Record<string, unknown> | undefined;

  if (header && typeof header === "object") {
    const hRows = flattenRows(header);
    if (hRows.length) out.push({ title: "Kopgegevens", rows: hRows });
  }
  if (answers && typeof answers === "object") {
    const aRows = flattenRows(answers);
    if (aRows.length) out.push({ title: "Antwoorden checklist", rows: aRows });
  }
  if (extras && typeof extras === "object") {
    const eRows = flattenRows(extras);
    if (eRows.length) out.push({ title: "Aanvullende informatie", rows: eRows });
  }
  if (stats && typeof stats === "object") {
    const sRows = flattenRows(stats);
    if (sRows.length) out.push({ title: "Statistieken", rows: sRows });
  }

  // Any remaining top-level detail keys we didn't already handle
  const handled = new Set(["header", "answers", "extras", "stats", "signature", "attachments"]);
  const extra = Object.fromEntries(Object.entries(d).filter(([k]) => !handled.has(k)));
  const extraRows = flattenRows(extra);
  if (extraRows.length) out.push({ title: "Details", rows: extraRows });

  if (r.description) out.push({ title: "Beschrijving", rows: [["Beschrijving", r.description]] });
  if (r.follow_up_notes) out.push({ title: "Opvolging", rows: [["Notities", r.follow_up_notes]] });
  return out;
}

const sectionsFor = (r: ReportExport) =>
  r.type === "ao_ehbo" ? aoSections(r) : genericSections(r);

const filename = (r: ReportExport, ext: string) =>
  `TSA_${label(r.type).short}_${(r.details as { incident_date?: string })?.incident_date ?? r.observed_at.slice(0, 10)}_${r.id.slice(0, 8)}.${ext}`;

// ---------------- PDF ----------------
export async function exportReportPdf(r: ReportExport) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const lab = label(r.type);
  const logo = await loadLogo();

  const drawHeader = () => {
    doc.setFillColor(...TSA_DARK);
    doc.rect(0, 0, pageW, 22, "F");
    doc.setFillColor(...TSA_RED);
    doc.rect(0, 22, pageW, 2, "F");
    if (logo) {
      const h = 14;
      const w = (logo.width / logo.height) * h;
      doc.addImage(logo.dataUrl, "PNG", 12, 4, w, h);
    }
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(lab.title.toUpperCase(), pageW - 12, 12, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("TSA Safety Services", pageW - 12, 18, { align: "right" });
  };

  const drawFooter = () => {
    doc.setDrawColor(...TSA_RED);
    doc.setLineWidth(0.6);
    doc.line(12, pageH - 14, pageW - 12, pageH - 14);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`TSA Safety Services  •  tsa-safety.be`, 12, pageH - 9);
    doc.text(`Gegenereerd ${nowStamp()}`, pageW / 2, pageH - 9, { align: "center" });
  };

  drawHeader();
  let y = 32;
  doc.setTextColor(...TSA_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(r.title, 12, y);
  y += 8;

  for (const section of sectionsFor(r)) {
    autoTable(doc, {
      startY: y,
      head: [[section.title]],
      body: section.rows.map(([k, v]) => [k, v]),
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 3, lineColor: [229, 229, 229], lineWidth: 0.1, textColor: TSA_DARK },
      headStyles: { fillColor: TSA_DARK, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 10, halign: "left", cellPadding: 3 },
      alternateRowStyles: { fillColor: TSA_LIGHT },
      columnStyles: { 0: { cellWidth: 55, fontStyle: "bold", fillColor: TSA_LIGHT, textColor: TSA_DARK } },
      margin: { left: 12, right: 12, top: 28, bottom: 20 },
      didDrawPage: () => drawHeader(),
    });
    // @ts-expect-error jspdf-autotable augments doc
    y = (doc.lastAutoTable?.finalY ?? y) + 6;
  }

  // Attachment images (if any AO photos in reports-attachments bucket)
  const atts = ((r.details as { attachments?: Array<{ path: string; name: string; type: string }> })?.attachments) ?? [];
  const imageAtts = atts.filter((a) => a.type?.startsWith("image/"));
  if (imageAtts.length) {
    if (y > pageH - 60) { doc.addPage(); drawHeader(); y = 32; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...TSA_DARK);
    doc.text("BIJLAGEN", 12, y);
    y += 4;
    doc.setDrawColor(...TSA_RED); doc.setLineWidth(0.4);
    doc.line(12, y, pageW - 12, y);
    y += 4;
    for (const att of imageAtts) {
      try {
        const { data } = await supabase.storage.from("reports-attachments").createSignedUrl(att.path, 300);
        if (!data?.signedUrl) continue;
        const res = await fetch(data.signedUrl);
        const blob = await res.blob();
        const dataUrl: string = await new Promise((r2) => {
          const fr = new FileReader();
          fr.onload = () => r2(fr.result as string);
          fr.readAsDataURL(blob);
        });
        if (y > pageH - 80) { doc.addPage(); drawHeader(); y = 32; }
        doc.addImage(dataUrl, "JPEG", 12, y, 80, 60);
        doc.setFontSize(8); doc.setTextColor(120, 120, 120);
        doc.text(att.name, 96, y + 8);
        y += 66;
      } catch { /* skip */ }
    }
  }

  // Footers on every page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawFooter();
  }
  doc.save(filename(r, "pdf"));
}

// ---------------- Excel ----------------
export function exportReportExcel(r: ReportExport) {
  const wb = XLSX.utils.book_new();
  const lab = label(r.type);
  const rows: (string | number)[][] = [
    ["TSA Safety Services"],
    [lab.title],
    [],
  ];
  for (const section of sectionsFor(r)) {
    rows.push([section.title]);
    for (const [k, v] of section.rows) rows.push([k, v]);
    rows.push([]);
  }
  rows.push(["Gegenereerd", nowStamp()]);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 28 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, ws, "Melding");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename(r, "xlsx"));
}
