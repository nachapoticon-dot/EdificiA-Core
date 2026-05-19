# Lectura Agéntica de Documentos de Obra

> Cómo EdificIA debe evolucionar de "ejecutar tools" a leer documentos como un Project Manager Digital.

## 1. Problema actual

El agente hoy tiende a comportarse como un pipeline:

1. recibe archivo
2. ejecuta tools conocidas
3. resume resultados

Eso funciona para demos controladas, pero no alcanza para un producto empresarial. Una constructora no necesita un programa que corra checks fijos; necesita un agente que entienda qué está mirando, por qué importa y qué decisión puede tomar con esa información.

## 2. Nuevo principio

Las tools no son el agente. Las tools son instrumentos.

El agente debe:

- leer el documento
- formar una hipótesis
- decidir qué necesita verificar
- contrastar contra obra, empresa y documentos relacionados
- separar hechos de inferencias
- explicar riesgos y próximos pasos

## 3. Ciclo de lectura documental

Cada archivo debe pasar por un ciclo conceptual:

1. **Clasificación**: qué tipo de documento es.
2. **Propósito**: qué intenta probar, cobrar, presupuestar, justificar o habilitar.
3. **Extracción**: obra, fecha, versión, responsables, montos, cantidades, proveedores, vencimientos.
4. **Contextualización**: relación con obra activa, documentos previos, patrones de empresa y fuentes externas.
5. **Verificación**: uso de tools matemáticas, RAG, comparación de versiones o reglas de dominio.
6. **Síntesis**: veredicto, hechos comprobados, inferencias, riesgos y próximos pasos.

## 4. Diferencia entre check y juicio

Un check dice:

> El total calculado es distinto al declarado.

Un agente debe decir:

> El presupuesto no cierra contra el total declarado. La diferencia puede deberse a redondeos acumulados o a partidas omitidas. Antes de aprobarlo, conviene revisar las líneas de mayor incidencia y compararlo contra la versión contractual o la memoria de cómputo.

El segundo caso conecta cálculo, causa probable, impacto y acción.

## 5. Tools necesarias a futuro

Para dejar de depender de recetas fijas, conviene crear tools de lectura más semánticas:

- `clasificar_documento_obra`
- `extraer_metadatos_documento`
- `detectar_entidades_obra`
- `relacionar_documento_con_obra`
- `comparar_documento_con_contexto`
- `evaluar_confiabilidad_extraccion`
- `formular_hipotesis_auditoria`

No todas tienen que ser tools de LLM. Algunas pueden ser funciones determinísticas o pipelines internos.

## 6. Contratos de salida

Toda lectura documental debería poder producir:

- tipo documental
- obra relacionada
- fecha y versión
- entidades detectadas
- datos cuantitativos
- señales de riesgo
- confianza de extracción
- fuentes relacionadas
- recomendación de siguiente acción

Esto permitiría que la UI muestre una lectura preliminar antes de cualquier auditoría pesada.

## 7. UX esperada

El usuario no debería ver "ejecutando 9 reglas". Debería ver estados como:

- Leyendo estructura del documento
- Identificando obra y versión
- Contrastando contra contexto de empresa
- Verificando consistencia financiera
- Preparando síntesis de riesgos

Eso comunica que EdificIA razona sobre la obra, no que corre una macro.

## 8. Regla de producto

EdificIA debe poder auditar un documento aunque no sea perfecto, aunque venga incompleto y aunque no encaje en una plantilla. Cuando no pueda cerrar una conclusión, debe decir qué falta y por qué, no forzar un resultado.

## 9. Bloques visuales como contrato de respuesta

Los bloques creados en `src/components/chat/blocks/` no son una galería ni una demo aislada. Son una capa de UI generativa conectada al agente mediante:

- tools de presentación en `src/lib/ai/agent-tools.ts`
- schemas Zod en `src/lib/validators/blocks.ts`
- render automático en `src/components/chat/MessageBubble.tsx`
- demo de verificación visual en `/dashboard/blocks-demo` solo en desarrollo

Uso esperado:

- `proyectar_metricas`: auditorías con KPIs, incidencias por rubro, desvíos, curva financiera resumida o indicadores con confianza.
- `proyectar_legajo_grafico`: planos, renders, fotos o documentos visuales reales encontrados en la base documental del tenant/obra.
- `proyectar_comparativa`: ranking multi-opción de proveedores, materiales, ofertas o alternativas con criterios comunes.
- `proyectar_cronograma`: cronogramas, hitos, fases, avance o reprogramaciones con fechas/fases suficientes.
- `comparar_presupuestos`: comparación A/B de dos presupuestos Excel cuando se necesita detalle de filas, diferencias y totales.

Reglas de uso:

- No proyectar bloques si faltan datos mínimos. Pedir precisión antes de inventar métricas, fechas, scores o documentos.
- No duplicar la visualización con una tabla Markdown. El bloque muestra; el texto posterior interpreta.
- Después del bloque, agregar una lectura ejecutiva corta: excepción, impacto y próxima acción.
- Citar fuente cuando exista y usar `confidence` en hallazgos o KPIs con evidencia parcial.
- Si una búsqueda visual no encuentra documentos, comunicar ausencia de evidencia; no presentarlo como una comprobación positiva.
