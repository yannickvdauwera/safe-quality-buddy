import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, WidthType, BorderStyle, AlignmentType, ImageRun,
  Header, Footer, PageNumber, ShadingType,
} from "docx";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { supabase } from "@/integrations/supabase/client";
import { TYPE_LABELS, type SafetyObservationType } from "./safety-observations";
import tsaLogoUrl from "@/assets/tsa-logo.png";

export interface ObservationExport {
  id: string;
  type: SafetyObservationType;
  reporter_name: string;
  reporter_function: string | null;
  observed_date: string;
  observed_time: string | null;
  plant: string | null;
  area: string | null;
  location: string | null;
  involved_party: string | null;
  hazards: string[];
  risks: string[];
  situation_description: string | null;
  action_taken: string | null;
  improvement_proposal: string | null;
  company_action: string | null;
  status: string;
  photos?: string[] | null;
  signature_data_url?: string | null;
  signer_name?: string | null;
  signer_function?: string | null;
}

async function loadPhotoBytes(paths: string[]): Promise<{ dataUrl: string; bytes: Uint8Array }[]> {
  const out: { dataUrl: string; bytes: Uint8Array }[] = [];
  for (const p of paths) {
    const { data } = await supabase.storage.from("safety-observations").createSignedUrl(p, 300);
    if (!data?.signedUrl) continue;
    try {
      const res = await fetch(data.signedUrl);
      const blob = await res.blob();
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const dataUrl: string = await new Promise((r) => {
        const fr = new FileReader();
        fr.onload = () => r(fr.result as string);
        fr.readAsDataURL(blob);
      });
      out.push({ dataUrl, bytes });
    } catch {
      /* skip */
    }
  }
  return out;
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(",")[1] ?? "";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// TSA brand palette
const TSA_RED: [number, number, number] = [227, 6, 19];
const TSA_DARK: [number, number, number] = [26, 26, 26];
const TSA_LIGHT: [number, number, number] = [245, 245, 247];
const TSA_RED_HEX = "E30613";
const TSA_DARK_HEX = "1A1A1A";
const TSA_LIGHT_HEX = "F5F5F7";
const TSA_BORDER_HEX = "E5E5E5";

const sections = (o: ObservationExport): Array<{ title: string; rows: Array<[string, string]> }> => [
  {
    title: "Melder",
    rows: [
      ["Naam", o.reporter_name],
      ["Functie", o.reporter_function ?? "—"],
    ],
  },
  {
    title: "Tijd & locatie",
    rows: [
      ["Datum", o.observed_date],
      ["Tijdstip", o.observed_time ?? "—"],
      ["Plant", o.plant ?? "—"],
      ["Area", o.area ?? "—"],
      ["Locatie", o.location ?? "—"],
      ["Betrokken firma/persoon", o.involved_party ?? "—"],
    ],
  },
  {
    title: "Gevaren & risico's",
    rows: [
      ["Gevaren", o.hazards.length ? o.hazards.join(" • ") : "—"],
      ["Risico's", o.risks.length ? o.risks.join(" • ") : "—"],
    ],
  },
  {
    title: "Beschrijving & opvolging",
    rows: [
      ["Omschrijving situatie", o.situation_description ?? "—"],
      ["Ondernomen actie", o.action_taken ?? "—"],
      ["Voorstel tot verbetering", o.improvement_proposal ?? "—"],
      ["Actie van het bedrijf", o.company_action ?? "—"],
      ["Status", o.status],
    ],
  },
  {
    title: "Bijlagen",
    rows: [
      ["Foto's", o.photos?.length ? `${o.photos.length} bijgevoegd` : "—"],
      ["Handtekening", o.signature_data_url ? "Ja" : "—"],
      ["Ondertekenaar", o.signer_name ?? "—"],
      ["Functie ondertekenaar", o.signer_function ?? "—"],
    ],
  },
];

const filename = (o: ObservationExport, ext: string) =>
  `TSA_${TYPE_LABELS[o.type].short}_${o.observed_date}_${o.id.slice(0, 8)}.${ext}`;

const nowStamp = () =>
  new Date().toLocaleString("nl-BE", { dateStyle: "long", timeStyle: "short" });

async function loadLogo(): Promise<{ dataUrl: string; bytes: Uint8Array; width: number; height: number }> {
  const res = await fetch(tsaLogoUrl);
  const blob = await res.blob();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const dataUrl: string = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
  const dims = await new Promise<{ width: number; height: number }>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.src = dataUrl;
  });
  return { dataUrl, bytes, ...dims };
}

// ---------------- PDF ----------------
export async function exportToPdf(o: ObservationExport) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const label = TYPE_LABELS[o.type];

  const logo = await loadLogo().catch(() => null);

  const drawHeader = () => {
    // Dark band with red accent stripe (so the red TSA logo stays visible)
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
    doc.text(label.title.toUpperCase(), pageW - 12, 12, { align: "right" });
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
    doc.text(`TSA Safety Services  •  tsa-safety.be`, 12, pageH - 9);
    doc.text(`Gegenereerd ${nowStamp()}`, pageW / 2, pageH - 9, { align: "center" });
    doc.text(`Pagina ${page} / ${total}`, pageW - 12, pageH - 9, { align: "right" });
  };

  drawHeader();

  // Meta block
  let y = 32;
  doc.setTextColor(...TSA_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Referentie: ${o.id.slice(0, 8).toUpperCase()}`, 12, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(label.title, 12, y + 5);
  y += 12;

  for (const section of sections(o)) {
    autoTable(doc, {
      startY: y,
      head: [[section.title]],
      body: section.rows.map(([k, v]) => [k, v]),
      theme: "grid",
      styles: {
        fontSize: 9,
        cellPadding: 3,
        lineColor: [229, 229, 229],
        lineWidth: 0.1,
        textColor: TSA_DARK,
      },
      headStyles: {
        fillColor: TSA_DARK,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 10,
        halign: "left",
        cellPadding: 3,
      },
      alternateRowStyles: { fillColor: TSA_LIGHT },
      columnStyles: {
        0: { cellWidth: 55, fontStyle: "bold", fillColor: TSA_LIGHT, textColor: TSA_DARK },
      },
      margin: { left: 12, right: 12, top: 28, bottom: 20 },
      didDrawPage: () => drawHeader(),
    });
    // @ts-expect-error jspdf-autotable augments doc
    y = (doc.lastAutoTable?.finalY ?? y) + 6;
  }

  // Signature block
  if (o.signature_data_url) {
    if (y > pageH - 60) { doc.addPage(); drawHeader(); y = 32; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...TSA_DARK);
    doc.text("ONDERTEKENING", 12, y);
    y += 4;
    doc.setDrawColor(...TSA_RED);
    doc.setLineWidth(0.4);
    doc.line(12, y, pageW - 12, y);
    y += 4;
    try {
      doc.addImage(o.signature_data_url, "PNG", 12, y, 70, 26);
    } catch { /* ignore */ }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...TSA_DARK);
    doc.text(o.signer_name ?? o.reporter_name, 90, y + 10);
    doc.setTextColor(120, 120, 120);
    doc.text(o.signer_function ?? o.reporter_function ?? "", 90, y + 15);
    y += 32;
  }

  // Photos
  const photoBytes = o.photos?.length ? await loadPhotoBytes(o.photos) : [];
  if (photoBytes.length) {
    if (y > pageH - 70) { doc.addPage(); drawHeader(); y = 32; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...TSA_DARK);
    doc.text("FOTO'S", 12, y);
    y += 4;
    doc.setDrawColor(...TSA_RED);
    doc.line(12, y, pageW - 12, y);
    y += 4;
    const colW = (pageW - 24 - 6) / 2;
    const rowH = 55;
    let col = 0;
    for (const p of photoBytes) {
      if (y + rowH > pageH - 20) { doc.addPage(); drawHeader(); y = 32; col = 0; }
      const x = 12 + col * (colW + 6);
      try {
        doc.addImage(p.dataUrl, "JPEG", x, y, colW, rowH);
      } catch { /* skip broken image */ }
      col++;
      if (col === 2) { col = 0; y += rowH + 4; }
    }
    if (col !== 0) y += rowH + 4;
  }

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawFooter(i, total);
  }

  doc.save(filename(o, "pdf"));
}

// ---------------- DOCX ----------------
export async function exportToDocx(o: ObservationExport) {
  const label = TYPE_LABELS[o.type];
  const logo = await loadLogo().catch(() => null);

  const border = { style: BorderStyle.SINGLE, size: 4, color: TSA_BORDER_HEX };
  const borders = { top: border, bottom: border, left: border, right: border };
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

  const cell = (text: string, opts: { bold?: boolean; bg?: string; color?: string; width: number } = { width: 4680 }) =>
    new TableCell({
      borders,
      width: { size: opts.width, type: WidthType.DXA },
      shading: opts.bg ? { fill: opts.bg, type: ShadingType.CLEAR, color: "auto" } : undefined,
      margins: { top: 100, bottom: 100, left: 140, right: 140 },
      children: [new Paragraph({
        children: [new TextRun({ text: text || "—", bold: opts.bold, color: opts.color })],
      })],
    });

  const sectionHeader = (title: string) =>
    new TableRow({
      children: [
        new TableCell({
          borders,
          columnSpan: 2,
          width: { size: 9360, type: WidthType.DXA },
          shading: { fill: TSA_DARK_HEX, type: ShadingType.CLEAR, color: "auto" },
          margins: { top: 120, bottom: 120, left: 140, right: 140 },
          children: [new Paragraph({
            children: [new TextRun({ text: title.toUpperCase(), bold: true, color: "FFFFFF", size: 22 })],
          })],
        }),
      ],
    });

  const bodyRows: TableRow[] = [];
  for (const s of sections(o)) {
    bodyRows.push(sectionHeader(s.title));
    for (const [k, v] of s.rows) {
      bodyRows.push(new TableRow({
        children: [
          cell(k, { bold: true, bg: TSA_LIGHT_HEX, width: 3200 }),
          cell(v, { width: 6160 }),
        ],
      }));
    }
  }

  // Header banner: 2-col table (logo | title on red)
  const bannerCells: TableCell[] = [];
  if (logo) {
    bannerCells.push(new TableCell({
      borders: noBorders,
      width: { size: 3000, type: WidthType.DXA },
      shading: { fill: TSA_RED_HEX, type: ShadingType.CLEAR, color: "auto" },
      margins: { top: 160, bottom: 160, left: 200, right: 100 },
      children: [new Paragraph({
        children: [new ImageRun({
          type: "png",
          data: logo.bytes,
          transformation: { width: 90, height: Math.round((logo.height / logo.width) * 90) },
        } as never)],
      })],
    }));
  }
  bannerCells.push(new TableCell({
    borders: noBorders,
    width: { size: logo ? 6360 : 9360, type: WidthType.DXA },
    shading: { fill: TSA_RED_HEX, type: ShadingType.CLEAR, color: "auto" },
    margins: { top: 160, bottom: 160, left: 200, right: 200 },
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: label.title.toUpperCase(), bold: true, color: "FFFFFF", size: 32 })],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: "TSA Safety Services", color: "FFFFFF", size: 20 })],
      }),
    ],
  }));

  const banner = new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: logo ? [3000, 6360] : [9360],
    rows: [new TableRow({ children: bannerCells })],
  });

  const dataTable = new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [3200, 6160],
    rows: bodyRows,
  });

  // Extra blocks (signature + photos)
  const extras: Paragraph[] = [];
  if (o.signature_data_url) {
    extras.push(new Paragraph({
      spacing: { before: 300, after: 100 },
      children: [new TextRun({ text: "ONDERTEKENING", bold: true, color: TSA_DARK_HEX, size: 22 })],
    }));
    try {
      extras.push(new Paragraph({
        children: [new ImageRun({
          type: "png",
          data: dataUrlToBytes(o.signature_data_url),
          transformation: { width: 200, height: 80 },
        } as never)],
      }));
    } catch { /* ignore */ }
    extras.push(new Paragraph({
      children: [new TextRun({
        text: `${o.signer_name ?? o.reporter_name}${o.signer_function ? " — " + o.signer_function : ""}`,
        color: "555555",
      })],
    }));
  }

  const photoBytes = o.photos?.length ? await loadPhotoBytes(o.photos) : [];
  if (photoBytes.length) {
    extras.push(new Paragraph({
      spacing: { before: 300, after: 100 },
      children: [new TextRun({ text: "FOTO'S", bold: true, color: TSA_DARK_HEX, size: 22 })],
    }));
    for (const p of photoBytes) {
      try {
        extras.push(new Paragraph({
          spacing: { after: 120 },
          children: [new ImageRun({
            type: "jpg",
            data: p.bytes,
            transformation: { width: 380, height: 250 },
          } as never)],
        }));
      } catch { /* skip */ }
    }
  }

  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Calibri", size: 20 } } },
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1000, right: 1000, bottom: 1200, left: 1000 },
        },
      },
      headers: {
        default: new Header({ children: [new Paragraph("")] }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            border: { top: { style: BorderStyle.SINGLE, size: 6, color: TSA_RED_HEX, space: 6 } },
            children: [
              new TextRun({ text: "TSA Safety Services  •  tsa-safety.be  •  ", color: "888888", size: 16 }),
              new TextRun({ text: `Gegenereerd ${nowStamp()}  •  Pagina `, color: "888888", size: 16 }),
              new TextRun({ children: [PageNumber.CURRENT], color: "888888", size: 16 }),
              new TextRun({ text: " / ", color: "888888", size: 16 }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], color: "888888", size: 16 }),
            ],
          })],
        }),
      },
      children: [
        banner,
        new Paragraph({
          spacing: { before: 200, after: 100 },
          children: [
            new TextRun({ text: "Referentie: ", bold: true, color: TSA_DARK_HEX }),
            new TextRun({ text: o.id.slice(0, 8).toUpperCase(), color: TSA_DARK_HEX }),
          ],
        }),
        new Paragraph({
          spacing: { after: 200 },
          children: [new TextRun({ text: label.title, color: "666666", italics: true })],
        }),
        dataTable,
        ...extras,
      ],
    }],
  });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename(o, "docx"));
}

// ---------------- XLSX ----------------
export function exportToXlsx(o: ObservationExport) {
  const label = TYPE_LABELS[o.type];
  const aoa: (string | number)[][] = [];
  aoa.push(["TSA Safety Services"]);
  aoa.push([label.title]);
  aoa.push([`Referentie: ${o.id.slice(0, 8).toUpperCase()}`]);
  aoa.push([`Gegenereerd: ${nowStamp()}`]);
  aoa.push([]);
  for (const s of sections(o)) {
    aoa.push([s.title.toUpperCase()]);
    for (const [k, v] of s.rows) aoa.push([k, v]);
    aoa.push([]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 32 }, { wch: 80 }];

  // Merge banner rows across A:B
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 1 } },
  ];

  // Style banner cells (community xlsx ignores styles, but harmless)
  const brandStyle = { fill: { fgColor: { rgb: TSA_RED_HEX } }, font: { bold: true, color: { rgb: "FFFFFF" }, sz: 14 } };
  const titleStyle = { font: { bold: true, sz: 12, color: { rgb: TSA_DARK_HEX } } };
  (ws["A1"] as XLSX.CellObject).s = brandStyle;
  (ws["A2"] as XLSX.CellObject).s = titleStyle;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, TYPE_LABELS[o.type].short);
  XLSX.writeFile(wb, filename(o, "xlsx"));
}
