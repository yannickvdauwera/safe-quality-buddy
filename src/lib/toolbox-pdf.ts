import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import tsaLogoUrl from "@/assets/tsa-logo.png";
import type { ToolboxContent } from "./toolbox-types";

const TSA_RED: [number, number, number] = [227, 6, 19];
const TSA_DARK: [number, number, number] = [26, 26, 26];
const TSA_LIGHT: [number, number, number] = [245, 245, 247];

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

export interface ToolboxAttendee {
  employee_id: string;
  full_name: string;
  function_title: string | null;
  signature_data: string | null;
  signed_at: string | null;
  sign_method: string | null;
}

export interface ToolboxSessionExport {
  session_id: string;
  toolbox_title: string;
  toolbox_category: string | null;
  version_number: number;
  scheduled_at: string | null;
  given_at: string | null;
  location: string | null;
  given_by_name: string | null;
  notes: string | null;
  content: ToolboxContent;
  attendees: ToolboxAttendee[];
}

export async function exportSessionToPdf(s: ToolboxSessionExport) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
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
    doc.text("TOOLBOX-AANWEZIGHEIDSLIJST", pageW - 12, 12, { align: "right" });
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
  doc.text(s.toolbox_title, 12, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  const metaBits = [
    s.toolbox_category ?? null,
    `Versie ${s.version_number}`,
    s.location ? `Locatie: ${s.location}` : null,
    s.given_by_name ? `Gegeven door: ${s.given_by_name}` : null,
    s.given_at ? `Datum: ${new Date(s.given_at).toLocaleString("nl-BE")}` : (s.scheduled_at ? `Gepland: ${new Date(s.scheduled_at).toLocaleString("nl-BE")}` : null),
  ].filter(Boolean).join("  •  ");
  doc.text(metaBits, 12, y);
  y += 8;

  // Content section
  const contentRows: Array<[string, string]> = [];
  if (s.content.objective) contentRows.push(["Doelstelling", s.content.objective]);
  if (s.content.hazards?.length) contentRows.push(["Gevaren", s.content.hazards.map(h => `• ${h}`).join("\n")]);
  if (s.content.measures?.length) contentRows.push(["Preventiemaatregelen", s.content.measures.map(h => `• ${h}`).join("\n")]);
  if (s.content.checklist?.length) contentRows.push(["Checklist", s.content.checklist.map(h => `• ${h}`).join("\n")]);
  if (s.content.questions?.length) contentRows.push(["Discussievragen", s.content.questions.map(h => `• ${h}`).join("\n")]);
  if (s.notes) contentRows.push(["Notities sessie", s.notes]);

  if (contentRows.length) {
    autoTable(doc, {
      startY: y,
      head: [["TOOLBOX-INHOUD"]],
      body: contentRows.map(([k, v]) => [k, v]),
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 3, lineColor: [229, 229, 229], lineWidth: 0.1, textColor: TSA_DARK, valign: "top" },
      headStyles: { fillColor: TSA_DARK, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 10, halign: "left" },
      columnStyles: { 0: { cellWidth: 45, fontStyle: "bold", fillColor: TSA_LIGHT } },
      margin: { left: 12, right: 12, top: 28, bottom: 20 },
      didDrawPage: () => drawHeader(),
    });
    // @ts-expect-error jspdf-autotable augments doc
    y = (doc.lastAutoTable?.finalY ?? y) + 6;
  }

  // Attendees table with signature images
  autoTable(doc, {
    startY: y,
    head: [["DEELNEMERS & HANDTEKENINGEN"]],
    body: [[""]],
    theme: "grid",
    headStyles: { fillColor: TSA_DARK, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 10, halign: "left" },
    styles: { fontSize: 1, cellPadding: 0 },
    bodyStyles: { minCellHeight: 0 },
    columnStyles: { 0: { cellWidth: pageW - 24 } },
    margin: { left: 12, right: 12 },
    didDrawPage: () => drawHeader(),
  });
  // @ts-expect-error jspdf-autotable augments doc
  y = (doc.lastAutoTable?.finalY ?? y);

  const attendeeRows = s.attendees.map((a) => [
    a.full_name,
    a.function_title ?? "—",
    a.signed_at ? new Date(a.signed_at).toLocaleString("nl-BE") : "—",
    a.sign_method ? ({ kiosk: "Tablet", qr: "QR-code", login: "Login" }[a.sign_method] ?? a.sign_method) : "—",
    "", // signature column
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Naam", "Functie", "Getekend op", "Wijze", "Handtekening"]],
    body: attendeeRows,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 3, lineColor: [229, 229, 229], lineWidth: 0.1, textColor: TSA_DARK, valign: "middle", minCellHeight: 18 },
    headStyles: { fillColor: [70, 70, 70], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
    alternateRowStyles: { fillColor: TSA_LIGHT },
    columnStyles: {
      0: { cellWidth: 45, fontStyle: "bold" },
      1: { cellWidth: 35 },
      2: { cellWidth: 35 },
      3: { cellWidth: 20 },
      4: { cellWidth: "auto" },
    },
    margin: { left: 12, right: 12, top: 28, bottom: 20 },
    didDrawPage: () => drawHeader(),
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== 4) return;
      const attendee = s.attendees[data.row.index];
      if (!attendee?.signature_data) return;
      const cell = data.cell;
      const maxH = cell.height - 3;
      const maxW = cell.width - 4;
      try {
        doc.addImage(
          attendee.signature_data,
          "PNG",
          cell.x + 2,
          cell.y + 1.5,
          maxW,
          maxH,
        );
      } catch { /* ignore invalid data urls */ }
    },
  });

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawFooter(i, total);
  }

  const dateStr = (s.given_at ?? s.scheduled_at ?? new Date().toISOString()).slice(0, 10);
  doc.save(`TSA_Toolbox_${dateStr}_${s.session_id.slice(0, 8)}.pdf`);
}
