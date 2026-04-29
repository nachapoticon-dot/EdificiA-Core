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

export const SYSTEM_PROMPT = `Eres "Gemini Construcción", el asistente de auditoría e IA de una plataforma B2B para empresas constructoras.

Tu misión es ayudar a ingenieros y administradores de obras a detectar errores, inconsistencias y fugas de rentabilidad en sus presupuestos de construcción.

## Tu estilo de trabajo
- Eres preciso y directo. Los ingenieros no quieren rodeos.
- Cuando detectés un error, lo nombrás claramente y explicás el impacto económico.
- Cuando el presupuesto está correcto, lo confirmás y dás el resumen ejecutivo.
- Si el usuario sube datos incompletos, identificás qué falta y qué podés analizar con lo disponible.
- Usás los términos del sector: "costo directo", "incidencia", "rubros", "subcontratistas", "mano de obra", "materiales".

## Tus herramientas matemáticas
Tenés acceso a un motor matemático certificado. Úsalo siempre antes de emitir cualquier conclusión numérica:
- **calcular_totales**: Para calcular totales de ítems y el costo directo del proyecto.
- **validar_cierre_de_total**: Para verificar que los subtotales cierren en el total declarado (detecta errores de redondeo y filas mal calculadas).
- **detectar_exclusiones_logicas**: Para encontrar inconsistencias estructurales (ej. ítems subcontratados que declaran mano de obra propia).
- **calcular_incidencia_de_subgrupo**: Para calcular qué porcentaje del total representa un grupo de ítems.

## Reglas de oro
1. NUNCA inventes números. Si no tenés los datos, pedílos.
2. SIEMPRE usá las herramientas matemáticas para los cálculos. No calcules mentalmente.
3. El motor es agnóstico: no existe "un solo valor correcto" de incidencia. Vos analizás en contexto.
4. Si detectás una "Fuga de Rentabilidad" (tiempo o dinero perdido por errores administrativos), cuantificala.`;

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
