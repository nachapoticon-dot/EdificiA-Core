# Dominio: auditoría de presupuestos

El agente no hace cuentas: lee el documento, decide qué verificar y llama a
funciones determinísticas de `src/lib/math-engine/`. Las cifras de la respuesta
salen de esas funciones.

## Ítem de presupuesto

`code`, `description`, `unit`, `quantity`, `unitPrice`, `totalPrice` (declarado),
`isSubcontracted`, `hasInternalLabor`. El parser de Excel
(`src/lib/excel/parser.ts`) detecta las columnas por encabezado y extrae el
total declarado si existe.

## Cálculos

- **Total de línea**: `quantity × unitPrice`, redondeado a centavos.
- **Costo directo**: suma de los totales de línea.
- **Cierre**: el costo directo calculado contra el total declarado, con
  tolerancia relativa (0,5 % por defecto). Además, cualquier línea cuyo total
  declarado difiera en más de $0,02 del calculado cuenta como error.
- **Incidencia de un subgrupo**: suma de los ítems del subgrupo sobre el total
  general, en porcentaje.

## Reglas de consistencia (`detectarExclusionesLogicas`)

| Regla | Severidad |
|---|---|
| Ítem subcontratado que declara mano de obra propia | error |
| Precio unitario 0 con cantidad > 0 | error |
| Total declarado distinto de cantidad × precio (> 1 %) | advertencia |
| Cantidad 0 con precio > 0 | advertencia |
| Código repetido | error |
| Ítem en `%` con cantidad distinta de 1 | advertencia |
| Valores negativos | error |
| Precio por m² redondo (múltiplo de 1.000, ≥ 10.000) | observación |
| Precio unitario a más de 3σ de la media de su unidad (mín. 3 ítems) | advertencia |

## Índices de precio

`price_indices` guarda valores de referencia por rubro y período, de cuatro
fuentes: lista propia de la empresa, lista aprendida, CAC e INDEC. Los índices
son append-only: una corrección es una carga nueva. Al comparar, los ítems se
agrupan por rubro (detección por palabras clave en `src/lib/obra/phases.ts`) y
el precio promedio del grupo se compara con el índice más reciente de la fuente
más confiable disponible. Un desvío mayor a ±15 % se marca.

## Planos

De un DXF se extraen capas, entidades, cotas, textos y un resumen geométrico
(áreas de polilíneas cerradas y longitudes por capa). El cómputo contra el plano
compara la suma de cantidades en m² y ml del presupuesto con esas medidas y marca
desvíos mayores al 5 %. DWG no se procesa.

## Fases y cobertura documental

`src/lib/obra/phases.ts` define las fases de una obra (proyecto, fundaciones,
estructura, albañilería, cubierta, instalación sanitaria y eléctrica, terminaciones, presupuesto general) y los documentos
esperados en cada una. Al subir un archivo a una obra se asigna a una fase por
nombre y contenido, y la vista de la obra muestra qué falta.

## Expedientes

Cada sesión de chat dentro de una obra abre un expediente (`work_cases`). El
expediente acumula eventos (sesión asociada, turnos del agente, cambios de
estado) y se cierra con veredicto: `approved`, `flagged`, `inconclusive`,
`rejected` o `superseded`. El agente puede marcarlo como resuelto; cerrarlo o
archivarlo es una acción del usuario.
