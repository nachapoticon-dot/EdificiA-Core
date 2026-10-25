import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
} from "docx";

export interface MemoriaSection {
  title: string;
  content: string;
}

export interface MemoriaData {
  obraName: string;
  sections: MemoriaSection[];
  redactor?: string;
  companyName?: string;
}

const PRIMARY = "8B4513"; // terracotta hex (no #)
const LIGHT_BG = "F5F0EA";

function headerRow(obraName: string, companyName: string, date: string): Paragraph[] {
  return [
    new Paragraph({
      children: [new TextRun({ text: companyName, bold: true, size: 28, color: PRIMARY })],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [new TextRun({ text: "MEMORIA DESCRIPTIVA", bold: true, size: 32, color: PRIMARY })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Obra: ${obraName}`, bold: true, size: 24 })],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [new TextRun({ text: `Fecha: ${date}`, size: 20, color: "666666" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
  ];
}

function sectionParagraphs(section: MemoriaSection, index: number): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  paragraphs.push(
    new Paragraph({
      text: `${index + 1}. ${section.title.toUpperCase()}`,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 320, after: 120 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: PRIMARY, space: 4 },
      },
    }),
  );

  // Split on newlines so multi-paragraph content renders correctly
  for (const line of section.content.split("\n")) {
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: line, size: 22 })],
        spacing: { after: 120 },
      }),
    );
  }

  return paragraphs;
}

function signatureTable(redactor: string): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: LIGHT_BG },
            children: [
              new Paragraph({
                children: [new TextRun({ text: "Redactado por:", bold: true, size: 20 })],
                spacing: { before: 80, after: 40 },
              }),
              new Paragraph({
                children: [new TextRun({ text: redactor, size: 22, bold: true })],
                spacing: { after: 80 },
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [new TextRun({ text: "Firma:", bold: true, size: 20 })],
                spacing: { before: 80, after: 80 },
              }),
              new Paragraph({
                children: [new TextRun({ text: "_________________________", size: 22, color: "999999" })],
                spacing: { after: 80 },
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/**
 * Generates a .docx memoria descriptiva (server-side, returns Buffer).
 * Sections are rendered as numbered headings with body text.
 */
export async function generateMemoriaBuffer(data: MemoriaData): Promise<Buffer> {
  const date = new Date().toLocaleDateString("es-AR", {
    day: "2-digit", month: "long", year: "numeric",
  });
  const company = data.companyName ?? "EdificIA";

  const children: (Paragraph | Table)[] = [
    ...headerRow(data.obraName, company, date),
    ...data.sections.flatMap((s, i) => sectionParagraphs(s, i)),
    new Paragraph({ text: "", spacing: { before: 400 } }),
    signatureTable(data.redactor ?? "Profesional responsable"),
  ];

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 22 } },
      },
    },
    sections: [{ properties: {}, children }],
  });

  return Packer.toBuffer(doc);
}
