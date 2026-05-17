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

// ──────────────────────────────────────────────────────────────────────────
// Orden de Compra
// ──────────────────────────────────────────────────────────────────────────

export interface OrdenCompraItem {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal?: number;
}

export interface OrdenCompraData {
  obraName: string;
  ordenNumber?: string;
  vendor: {
    name: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
  };
  buyer?: {
    companyName?: string;
    signedBy?: string;
  };
  items: OrdenCompraItem[];
  currency?: string;
  subtotal?: number;
  taxPct?: number;
  taxAmount?: number;
  total?: number;
  deliveryAddress?: string;
  deliveryDate?: string;
  paymentTerms?: string;
  notes?: string;
}

function formatMoney(amount: number, currency: string): string {
  const formatted = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${currency} ${formatted}`;
}

function ordenCompraTable(items: OrdenCompraItem[], currency: string): Table {
  const headerCells = ["Descripción", "Cant.", "Unidad", "Precio Unit.", "Subtotal"].map(
    (text) =>
      new TableCell({
        shading: { type: ShadingType.SOLID, color: PRIMARY },
        children: [
          new Paragraph({
            children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 20 })],
            alignment: AlignmentType.CENTER,
          }),
        ],
      }),
  );

  const itemRows = items.map((item) => {
    const lineTotal = item.lineTotal ?? item.quantity * item.unitPrice;
    return new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.description, size: 20 })] })] }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: String(item.quantity), size: 20 })], alignment: AlignmentType.RIGHT })],
        }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.unit, size: 20 })], alignment: AlignmentType.CENTER })] }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: formatMoney(item.unitPrice, currency), size: 20 })], alignment: AlignmentType.RIGHT })],
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: formatMoney(lineTotal, currency), size: 20, bold: true })], alignment: AlignmentType.RIGHT })],
        }),
      ],
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: headerCells }), ...itemRows],
  });
}

function totalsTable(data: OrdenCompraData, currency: string): Table {
  const subtotal = data.subtotal ?? data.items.reduce((sum, it) => sum + (it.lineTotal ?? it.quantity * it.unitPrice), 0);
  const taxAmount = data.taxAmount ?? (data.taxPct ? subtotal * (data.taxPct / 100) : 0);
  const total = data.total ?? subtotal + taxAmount;
  const rows: Array<[string, string]> = [["Subtotal", formatMoney(subtotal, currency)]];
  if (data.taxPct && data.taxPct > 0) rows.push([`IVA ${data.taxPct}%`, formatMoney(taxAmount, currency)]);
  rows.push(["TOTAL", formatMoney(total, currency)]);

  return new Table({
    width: { size: 50, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.RIGHT,
    rows: rows.map(([label, value], idx) => {
      const isTotal = idx === rows.length - 1;
      return new TableRow({
        children: [
          new TableCell({
            shading: isTotal ? { type: ShadingType.SOLID, color: LIGHT_BG } : undefined,
            children: [new Paragraph({ children: [new TextRun({ text: label, bold: isTotal, size: isTotal ? 22 : 20 })] })],
          }),
          new TableCell({
            shading: isTotal ? { type: ShadingType.SOLID, color: LIGHT_BG } : undefined,
            children: [
              new Paragraph({
                children: [new TextRun({ text: value, bold: isTotal, size: isTotal ? 22 : 20 })],
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        ],
      });
    }),
  });
}

export async function generateOrdenCompraBuffer(data: OrdenCompraData): Promise<Buffer> {
  const date = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
  const currency = data.currency ?? "ARS";
  const buyer = data.buyer?.companyName ?? "EdificIA";
  const ordenNumber = data.ordenNumber ?? `OC-${Date.now().toString(36).toUpperCase().slice(-6)}`;

  const children: (Paragraph | Table)[] = [
    new Paragraph({
      children: [new TextRun({ text: buyer, bold: true, size: 28, color: PRIMARY })],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [new TextRun({ text: "ORDEN DE COMPRA", bold: true, size: 32, color: PRIMARY })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 60 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Nº ${ordenNumber}`, bold: true, size: 22 }),
        new TextRun({ text: `    ·    Fecha: ${date}`, size: 20, color: "666666" }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 320 },
    }),

    new Paragraph({
      text: "OBRA / PROYECTO",
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 80, after: 60 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: PRIMARY, space: 4 } },
    }),
    new Paragraph({ children: [new TextRun({ text: data.obraName, size: 22, bold: true })], spacing: { after: 200 } }),

    new Paragraph({
      text: "PROVEEDOR",
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 80, after: 60 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: PRIMARY, space: 4 } },
    }),
    new Paragraph({ children: [new TextRun({ text: data.vendor.name, size: 22, bold: true })], spacing: { after: 40 } }),
    ...(data.vendor.contactName
      ? [new Paragraph({ children: [new TextRun({ text: `Contacto: ${data.vendor.contactName}`, size: 20 })], spacing: { after: 20 } })]
      : []),
    ...(data.vendor.contactEmail
      ? [new Paragraph({ children: [new TextRun({ text: `Email: ${data.vendor.contactEmail}`, size: 20 })], spacing: { after: 20 } })]
      : []),
    ...(data.vendor.contactPhone
      ? [new Paragraph({ children: [new TextRun({ text: `Tel: ${data.vendor.contactPhone}`, size: 20 })], spacing: { after: 200 } })]
      : []),

    new Paragraph({
      text: "ITEMS",
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 200, after: 80 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: PRIMARY, space: 4 } },
    }),
    ordenCompraTable(data.items, currency),
    new Paragraph({ text: "", spacing: { before: 200 } }),
    totalsTable(data, currency),
  ];

  if (data.deliveryAddress || data.deliveryDate || data.paymentTerms || data.notes) {
    children.push(
      new Paragraph({
        text: "CONDICIONES",
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 320, after: 80 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: PRIMARY, space: 4 } },
      }),
    );
    if (data.deliveryAddress)
      children.push(new Paragraph({ children: [new TextRun({ text: `Lugar de entrega: ${data.deliveryAddress}`, size: 20 })], spacing: { after: 40 } }));
    if (data.deliveryDate)
      children.push(new Paragraph({ children: [new TextRun({ text: `Fecha de entrega: ${data.deliveryDate}`, size: 20 })], spacing: { after: 40 } }));
    if (data.paymentTerms)
      children.push(new Paragraph({ children: [new TextRun({ text: `Forma de pago: ${data.paymentTerms}`, size: 20 })], spacing: { after: 40 } }));
    if (data.notes)
      children.push(new Paragraph({ children: [new TextRun({ text: data.notes, size: 20 })], spacing: { after: 120 } }));
  }

  children.push(new Paragraph({ text: "", spacing: { before: 400 } }));
  children.push(signatureTable(data.buyer?.signedBy ?? "Responsable de compras"));

  const doc = new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    sections: [{ properties: {}, children }],
  });
  return Packer.toBuffer(doc);
}

// ──────────────────────────────────────────────────────────────────────────
// Acta / Parte diario de obra
// ──────────────────────────────────────────────────────────────────────────

export interface ActaCrewMember {
  name?: string;
  role?: string;
  subcontractor?: string;
  count?: number;
}

export interface ActaTask {
  description: string;
  progress?: string;
  observations?: string;
}

export interface ActaIncident {
  severity: "leve" | "moderado" | "critico";
  description: string;
}

export interface ActaMaterialReceived {
  item: string;
  quantity?: string;
  supplier?: string;
}

export interface ActaObraData {
  obraName: string;
  date: string;
  weatherSummary?: string;
  crew?: ActaCrewMember[];
  tasksExecuted: ActaTask[];
  incidents?: ActaIncident[];
  materialsReceived?: ActaMaterialReceived[];
  visitsOnSite?: Array<{ name: string; role?: string }>;
  notes?: string;
  signedBy?: string;
  companyName?: string;
}

function actaSection(title: string, paragraphs: Paragraph[]): Paragraph[] {
  return [
    new Paragraph({
      text: title,
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 240, after: 80 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: PRIMARY, space: 4 } },
    }),
    ...paragraphs,
  ];
}

export async function generateActaObraBuffer(data: ActaObraData): Promise<Buffer> {
  const company = data.companyName ?? "EdificIA";
  const dateLabel = formatActaDate(data.date);

  const children: (Paragraph | Table)[] = [
    new Paragraph({
      children: [new TextRun({ text: company, bold: true, size: 28, color: PRIMARY })],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [new TextRun({ text: "PARTE DIARIO DE OBRA", bold: true, size: 32, color: PRIMARY })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Obra: ${data.obraName}`, bold: true, size: 24 })],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [new TextRun({ text: `Fecha: ${dateLabel}`, size: 20, color: "666666" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 320 },
    }),
  ];

  if (data.weatherSummary) {
    children.push(
      ...actaSection("CLIMA", [
        new Paragraph({ children: [new TextRun({ text: data.weatherSummary, size: 22 })], spacing: { after: 120 } }),
      ]),
    );
  }

  if (data.crew && data.crew.length > 0) {
    const crewLines = data.crew.map((m) => {
      const parts = [m.role, m.name, m.subcontractor, m.count ? `(${m.count})` : undefined].filter(Boolean);
      return new Paragraph({
        children: [new TextRun({ text: `• ${parts.join(" — ")}`, size: 22 })],
        spacing: { after: 60 },
      });
    });
    children.push(...actaSection("CUADRILLA", crewLines));
  }

  if (data.tasksExecuted.length > 0) {
    const taskLines = data.tasksExecuted.flatMap((t, idx) => {
      const main = new Paragraph({
        children: [new TextRun({ text: `${idx + 1}. ${t.description}`, size: 22, bold: true })],
        spacing: { after: 40 },
      });
      const meta: Paragraph[] = [];
      if (t.progress) {
        meta.push(new Paragraph({ children: [new TextRun({ text: `Avance: ${t.progress}`, size: 20, color: "555555" })], spacing: { after: 40 } }));
      }
      if (t.observations) {
        meta.push(new Paragraph({ children: [new TextRun({ text: `Obs: ${t.observations}`, size: 20, color: "555555" })], spacing: { after: 80 } }));
      }
      return [main, ...meta];
    });
    children.push(...actaSection("TAREAS EJECUTADAS", taskLines));
  }

  if (data.materialsReceived && data.materialsReceived.length > 0) {
    const lines = data.materialsReceived.map((m) => {
      const parts = [m.item, m.quantity, m.supplier ? `(${m.supplier})` : undefined].filter(Boolean);
      return new Paragraph({
        children: [new TextRun({ text: `• ${parts.join(" — ")}`, size: 22 })],
        spacing: { after: 60 },
      });
    });
    children.push(...actaSection("MATERIALES RECIBIDOS", lines));
  }

  if (data.incidents && data.incidents.length > 0) {
    const lines = data.incidents.map((inc) => {
      const sevLabel = inc.severity.toUpperCase();
      const color = inc.severity === "critico" ? "B91C1C" : inc.severity === "moderado" ? "B45309" : "555555";
      return new Paragraph({
        children: [
          new TextRun({ text: `[${sevLabel}] `, bold: true, size: 22, color }),
          new TextRun({ text: inc.description, size: 22 }),
        ],
        spacing: { after: 80 },
      });
    });
    children.push(...actaSection("INCIDENTES / OBSERVACIONES HSE", lines));
  }

  if (data.visitsOnSite && data.visitsOnSite.length > 0) {
    const lines = data.visitsOnSite.map(
      (v) =>
        new Paragraph({
          children: [new TextRun({ text: `• ${[v.name, v.role].filter(Boolean).join(" — ")}`, size: 22 })],
          spacing: { after: 60 },
        }),
    );
    children.push(...actaSection("VISITAS EN OBRA", lines));
  }

  if (data.notes) {
    children.push(
      ...actaSection("NOTAS", [
        new Paragraph({ children: [new TextRun({ text: data.notes, size: 22 })], spacing: { after: 120 } }),
      ]),
    );
  }

  children.push(new Paragraph({ text: "", spacing: { before: 400 } }));
  children.push(signatureTable(data.signedBy ?? "Capataz / Conductor de obra"));

  const doc = new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    sections: [{ properties: {}, children }],
  });
  return Packer.toBuffer(doc);
}

function formatActaDate(value: string): string {
  if (!value) return new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
    }
  }
  return value;
}
