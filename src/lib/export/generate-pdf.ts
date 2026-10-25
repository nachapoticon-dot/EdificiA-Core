
export interface InformeFinding {
  severity: "error" | "warning" | "info";
  code: string;
  title: string;
  detail: string;
  impact?: string;
  item?: string;
}

export interface InformeData {
  title: string;
  veredicto: "Aprobado" | "Observado" | "Requiere revisión";
  computedTotal?: number;
  declaredTotal?: number;
  difference?: number;
  items?: { code: string; description: string; quantity: number; unit: string; unitPrice: number; lineTotal: number }[];
  findings?: InformeFinding[];
  companyName?: string;
}

/**
 * Generates a PDF audit report server-side (no browser APIs).
 * Mirrors exportAuditPdf but accepts structured data instead of UIMessages.
 */
export async function generateInformePdfBuffer(data: InformeData): Promise<Buffer> {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 20;
  const marginR = 20;
  const contentW = pageW - marginL - marginR;
  const now = new Date().toLocaleString("es-AR");

  const COLORS = {
    black: [24, 24, 27] as [number, number, number],
    gray:  [113, 113, 122] as [number, number, number],
    light: [244, 244, 245] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
    amber: [245, 158, 11] as [number, number, number],
    red:   [239, 68, 68] as [number, number, number],
    green: [34, 197, 94] as [number, number, number],
  };

  const veredictoColor: [number, number, number] =
    data.veredicto === "Aprobado" ? COLORS.green
    : data.veredicto === "Observado" ? COLORS.amber
    : COLORS.red;

  let y = 0;

  doc.setFillColor(...COLORS.black);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.white);
  doc.text(data.companyName ?? "EdificIA", marginL, 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.gray);
  doc.text("Informe de auditoría para la construcción", marginL, 20);
  doc.text(now, pageW - marginR, 13, { align: "right" });

  y = 38;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.black);
  doc.text(data.title.slice(0, 60), marginL, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.gray);
  doc.text("Informe de auditoría generado automáticamente por EdificIA", marginL, y);
  y += 3;
  doc.setDrawColor(...COLORS.light);
  doc.setLineWidth(0.5);
  doc.line(marginL, y + 2, pageW - marginR, y + 2);
  y += 8;

  const kpis: { label: string; value: string; color: [number, number, number] }[] = [
    { label: "Veredicto", value: data.veredicto, color: veredictoColor },
  ];
  if (data.computedTotal != null) {
    kpis.push({ label: "Costo directo calculado", value: `$${Math.round(data.computedTotal).toLocaleString("es-AR")}`, color: COLORS.black });
  }
  if (data.difference != null && Math.abs(data.difference) > 0) {
    kpis.push({ label: "Brecha detectada", value: `$${Math.round(Math.abs(data.difference)).toLocaleString("es-AR")}`, color: COLORS.red });
  }
  if (data.findings) {
    const errors = data.findings.filter(f => f.severity === "error").length;
    kpis.push({ label: "Errores críticos", value: String(errors), color: errors > 0 ? COLORS.red : COLORS.green });
  }

  const boxW = contentW / kpis.length - 2;
  kpis.forEach((kpi, i) => {
    const bx = marginL + i * (boxW + 2);
    doc.setFillColor(...COLORS.light);
    doc.roundedRect(bx, y, boxW, 18, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...kpi.color);
    doc.text(kpi.value, bx + boxW / 2, y + 8, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.gray);
    doc.text(kpi.label, bx + boxW / 2, y + 14, { align: "center" });
  });
  y += 24;

  if (data.items && data.items.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.black);
    doc.text("Ítems del Presupuesto", marginL, y + 4);
    y += 8;

    autoTable(doc, {
      startY: y,
      head: [["Código", "Descripción", "Cant.", "Unid.", "P. Unit.", "Total"]],
      body: data.items.map(item => [
        item.code,
        item.description.slice(0, 55),
        item.quantity.toLocaleString("es-AR"),
        item.unit,
        `$${item.unitPrice.toLocaleString("es-AR")}`,
        `$${item.lineTotal.toLocaleString("es-AR")}`,
      ]),
      margin: { left: marginL, right: marginR },
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: COLORS.black, textColor: COLORS.white, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      columnStyles: { 0: { cellWidth: 18 }, 1: { cellWidth: "auto" }, 2: { cellWidth: 14, halign: "right" }, 3: { cellWidth: 12 }, 4: { cellWidth: 24, halign: "right" }, 5: { cellWidth: 26, halign: "right", fontStyle: "bold" } },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  if (data.findings && data.findings.length > 0) {
    if (y > pageH - 60) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.black);
    doc.text("Hallazgos de la Auditoría", marginL, y + 4);
    y += 8;

    autoTable(doc, {
      startY: y,
      head: [["Sev.", "Código", "Ítem", "Hallazgo", "Impacto"]],
      body: data.findings.map(f => [
        f.severity.toUpperCase(), f.code, f.item ?? "-",
        f.title + (f.detail ? `: ${f.detail.slice(0, 80)}` : ""),
        f.impact ?? "-",
      ]),
      margin: { left: marginL, right: marginR },
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: COLORS.black, textColor: COLORS.white, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      columnStyles: { 0: { cellWidth: 14 }, 1: { cellWidth: 22 }, 2: { cellWidth: 16 }, 3: { cellWidth: "auto" }, 4: { cellWidth: 28 } },
      didParseCell: (d) => {
        if (d.section === "body" && d.column.index === 0) {
          const sev = data.findings![d.row.index]?.severity ?? "info";
          d.cell.styles.textColor = sev === "error" ? COLORS.red : sev === "warning" ? COLORS.amber : COLORS.gray;
          d.cell.styles.fontStyle = "bold";
        }
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  const totalPages = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFillColor(...COLORS.light);
    doc.rect(0, pageH - 10, pageW, 10, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.gray);
    doc.text("EdificIA · Informe de auditoría", marginL, pageH - 3.5);
    doc.text(`Pág. ${p} / ${totalPages}`, pageW - marginR, pageH - 3.5, { align: "right" });
  }

  return Buffer.from(doc.output("arraybuffer") as ArrayBuffer);
}
