import * as XLSX from "xlsx";

export interface PresupuestoItem {
  code: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  group?: string;
}

export interface PresupuestoData {
  obraName: string;
  items: PresupuestoItem[];
  notes?: string;
  companyName?: string;
}

/**
 * Generates a construction budget .xlsx from scratch (server-side, returns Buffer).
 * Template: header block, items grouped by rubro, subtotals per group, grand total, notes.
 */
export function generatePresupuestoBuffer(data: PresupuestoData): Buffer {
  const wb = XLSX.utils.book_new();
  const now = new Date().toLocaleDateString("es-AR");

  const groups = new Map<string, PresupuestoItem[]>();
  for (const item of data.items) {
    const key = item.group ?? "Sin rubro";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  const rows: (string | number)[][] = [];

  // Title block
  rows.push([data.companyName ?? "EdificIA — Presupuesto de Obra", "", "", "", "", ""]);
  rows.push(["Obra:", data.obraName, "", "", "Fecha:", now]);
  rows.push([]);
  rows.push(["Código", "Descripción", "Cantidad", "Unidad", "P. Unitario ($)", "Total ($)"]);

  let grandTotal = 0;

  for (const [groupName, groupItems] of groups) {
    // Group header row
    rows.push([groupName.toUpperCase(), "", "", "", "", ""]);

    let groupTotal = 0;
    for (const item of groupItems) {
      const lineTotal = item.quantity * item.unitPrice;
      groupTotal += lineTotal;
      rows.push([
        item.code,
        item.description,
        item.quantity,
        item.unit,
        item.unitPrice,
        lineTotal,
      ]);
    }

    // Group subtotal
    rows.push(["", `SUBTOTAL — ${groupName}`, "", "", "", groupTotal]);
    rows.push([]);
    grandTotal += groupTotal;
  }

  // Grand total
  rows.push([]);
  rows.push(["", "COSTO DIRECTO TOTAL", "", "", "", grandTotal]);
  rows.push([]);

  if (data.notes) {
    rows.push(["NOTAS:", data.notes, "", "", "", ""]);
  }

  rows.push([]);
  rows.push(["", "Firma y aclaración:", "", "", "", ""]);
  rows.push(["", "_________________________________", "", "", "", ""]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 14 }, { wch: 55 }, { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 20 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Presupuesto");

  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as ArrayBuffer);
}
