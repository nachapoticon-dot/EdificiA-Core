import { tool } from "ai";
import {
  calcularTotalesInputSchema,
  validarCierreInputSchema,
  detectarExclusionesInputSchema,
  calcularIncidenciaInputSchema,
  type BudgetItem,
} from "@/lib/math-engine/validators";
import {
  calcularTotalLinea,
  calcularCostoDirecto,
} from "@/lib/math-engine/calculator";
import {
  validarCierreDeTotal,
  detectarExclusionesLogicas,
  calcularIncidenciaDeSubgrupo,
} from "@/lib/math-engine/auditor";

export const AI_MODEL = "claude-sonnet-4-6";

export const SYSTEM_PROMPT = `Sos EdificIA, el auditor de obras de Argentina. Trabajás para una plataforma B2B que ayuda a empresas constructoras a detectar errores, inconsistencias y fugas de rentabilidad en sus presupuestos.

## Tu estilo de trabajo
- Sos preciso y directo. Los ingenieros no quieren rodeos.
- Cuando detectás un error, lo nombrás claramente con el ítem afectado y el impacto económico en pesos.
- Cuando el presupuesto está correcto, lo confirmás con un resumen ejecutivo estructurado.
- Si los datos son incompletos, identificás exactamente qué falta antes de proceder.
- Usás los términos del sector: "costo directo", "incidencia", "rubros", "subcontratistas", "mano de obra", "materiales", "cómputo métrico".

## Tus herramientas matemáticas — úsalas SIEMPRE
Tenés un motor matemático certificado. Jamás calcules mentalmente:
- **calcular_totales** → Primer paso obligatorio: calcula totales línea por línea y el costo directo.
- **validar_cierre_de_total** → Solo después de calcular_totales: verifica que los subtotales cierren con el total declarado.
- **detectar_exclusiones_logicas** → Encuentra inconsistencias estructurales (ej. ítem subcontratado que declara mano de obra propia).
- **calcular_incidencia_de_subgrupo** → Calcula el peso porcentual de un grupo de ítems sobre el total.

## Flujo obligatorio cuando recibís un Excel
1. **calcular_totales** → verificá el costo directo real vs declarado.
2. **validar_cierre_de_total** (si hay total declarado) → detectá brechas.
3. **detectar_exclusiones_logicas** → encontrá errores estructurales.
4. **calcular_incidencia_de_subgrupo** → analizá los rubros más pesados (≥10% del total).
5. Entregá el resumen ejecutivo con este formato:
   - **Veredicto**: [✓ Aprobado / ✗ Observado / ⚠ Requiere revisión]
   - **Costo directo calculado**: $X.XXX.XXX
   - **Brecha detectada**: $X.XXX (si aplica)
   - **Hallazgos** (lista numerada)
   - **Recomendación**

## Flujo para PDFs, DXF y documentos
- Leé el contenido extraído y respondé si es un presupuesto, cómputo, plano o memoria descriptiva.
- Extraé todos los datos numéricos que puedas identificar.
- Si el PDF está escaneado (sin texto), analizá la imagen visualmente.

## Reglas de oro
1. NUNCA inventes números. Si no tenés los datos, pedílos.
2. SIEMPRE usá las herramientas matemáticas. Nunca calcules mentalmente.
3. El motor es agnóstico: no existe "un solo valor correcto" de incidencia. Vos analizás en contexto.
4. Cuando detectés una "Fuga de Rentabilidad" (dinero o tiempo perdido por errores administrativos), cuantificala en pesos y horas.`;

export const agentTools = {
  calcular_totales: tool({
    description:
      "Calcula los totales individuales de cada ítem y el costo directo total del presupuesto. Úsalo cuando necesités saber cuánto suma el presupuesto o verificar los cálculos línea por línea.",
    inputSchema: calcularTotalesInputSchema,
    execute: async (input: { items: BudgetItem[]; declaredTotal?: number }) => {
      const lineTotals = input.items.map(calcularTotalLinea);
      const computedTotal = calcularCostoDirecto(input.items);
      const diff = input.declaredTotal != null
        ? Math.round((input.declaredTotal - computedTotal) * 100) / 100
        : null;

      return {
        computedTotal,
        declaredTotal: input.declaredTotal ?? null,
        difference: diff,
        lineTotals,
        itemCount: input.items.length,
      };
    },
  }),

  validar_cierre_de_total: tool({
    description:
      "Verifica que la suma de los ítems coincida con el total declarado del presupuesto. Detecta errores de redondeo y líneas mal calculadas. Úsalo para auditar si el presupuesto 'cierra' correctamente.",
    inputSchema: validarCierreInputSchema,
    execute: async (input: {
      items: BudgetItem[];
      declaredTotal: number;
      tolerancePct?: number;
    }) => {
      return validarCierreDeTotal(
        input.items,
        input.declaredTotal,
        input.tolerancePct,
      );
    },
  }),

  detectar_exclusiones_logicas: tool({
    description:
      "Encuentra inconsistencias estructurales en el presupuesto. Ejemplo: un ítem marcado como subcontratado que también declara mano de obra interna (doble contabilización). Úsalo en toda auditoría de calidad.",
    inputSchema: detectarExclusionesInputSchema,
    execute: async (input: { items: BudgetItem[] }) => {
      const exclusiones = detectarExclusionesLogicas(input.items);
      return {
        erroresEncontrados: exclusiones.length,
        exclusiones,
        ok: exclusiones.length === 0,
        resumen:
          exclusiones.length === 0
            ? "✓ No se detectaron exclusiones lógicas en el presupuesto."
            : `✗ Se encontraron ${exclusiones.length} ítem(s) con inconsistencias lógicas.`,
      };
    },
  }),

  calcular_incidencia_de_subgrupo: tool({
    description:
      "Calcula qué porcentaje del total del proyecto representa un subgrupo de ítems (ej. todos los subcontratos, o todos los ítems de albañilería). Úsalo para analizar la composición y el peso de cada rubro.",
    inputSchema: calcularIncidenciaInputSchema,
    execute: async (input: {
      items: BudgetItem[];
      subgroupCodes: string[];
      grandTotal: number;
    }) => {
      return calcularIncidenciaDeSubgrupo(
        input.items,
        input.subgroupCodes,
        input.grandTotal,
      );
    },
  }),
};
