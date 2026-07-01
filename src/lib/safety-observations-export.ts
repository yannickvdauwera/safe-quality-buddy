import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, WidthType, BorderStyle, AlignmentType,
} from "docx";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { TYPE_LABELS, type SafetyObservationType } from "./safety-observations";

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
}

const fieldRows = (o: ObservationExport): Array<[string, string]> => [
  ["Type", TYPE_LABELS[o.type].title],
  ["Naam", o.reporter_name],
  ["Functie", o.reporter_function ?? ""],
  ["Datum", o.observed_date],
  ["Tijdstip", o.observed_time ?? ""],
  ["Plant", o.plant ?? ""],
  ["Area", o.area ?? ""],
  ["Locatie", o.location ?? ""],
  ["Betrokken firma/persoon", o.involved_party ?? ""],
  ["Gevaren", o.hazards.join(", ")],
  ["Risico's", o.risks.join(", ")],
  ["Omschrijving situatie", o.situation_description ?? ""],
  ["Ondernomen actie", o.action_taken ?? ""],
  ["Voorstel tot verbetering", o.improvement_proposal ?? ""],
  ["Actie van het bedrijf", o.company_action ?? ""],
  ["Status", o.status],
];

const filename = (o: ObservationExport, ext: string) =>
  `${TYPE_LABELS[o.type].short}_${o.observed_date}_${o.id.slice(0, 8)}.${ext}`;

export function exportToPdf(o: ObservationExport) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(TYPE_LABELS[o.type].title, 14, 18);
  autoTable(doc, {
    startY: 26,
    head: [["Veld", "Waarde"]],
    body: fieldRows(o),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235] },
    columnStyles: { 0: { cellWidth: 55, fontStyle: "bold" } },
  });
  doc.save(filename(o, "pdf"));
}

export async function exportToDocx(o: ObservationExport) {
  const border = { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" };
  const borders = { top: border, bottom: border, left: border, right: border };
  const rows = fieldRows(o).map(([k, v]) =>
    new TableRow({
      children: [
        new TableCell({
          borders,
          width: { size: 3500, type: WidthType.DXA },
          children: [new Paragraph({ children: [new TextRun({ text: k, bold: true })] })],
        }),
        new TableCell({
          borders,
          width: { size: 5860, type: WidthType.DXA },
          children: [new Paragraph(v || " ")],
        }),
      ],
    }),
  );

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.LEFT,
          children: [new TextRun({ text: TYPE_LABELS[o.type].title, bold: true, size: 32 })],
        }),
        new Paragraph(" "),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [3500, 5860],
          rows,
        }),
      ],
    }],
  });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename(o, "docx"));
}

export function exportToXlsx(o: ObservationExport) {
  const ws = XLSX.utils.aoa_to_sheet([["Veld", "Waarde"], ...fieldRows(o)]);
  ws["!cols"] = [{ wch: 28 }, { wch: 70 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, TYPE_LABELS[o.type].short);
  XLSX.writeFile(wb, filename(o, "xlsx"));
}
