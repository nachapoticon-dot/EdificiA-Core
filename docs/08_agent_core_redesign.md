# EdificIA Agent Core - Rediseño pragmático

> Objetivo: que EdificIA deje de organizar el trabajo alrededor de sesiones sueltas de chat y pase a operar como un Project Manager Digital continuo, trazable y mantenible.

## 1. Diagnóstico

El agente actual tiene piezas valiosas: aislamiento multi-tenant, tools bound por servidor, RAG filtrado por `organization_id`, audit log inmutable, motor de proactividad, daily brief y datos operativos reales de obra.

La deuda principal es conceptual. El producto todavía se organiza alrededor de `chat_sessions`, mensajes y prompts autogenerados. La obra activa viaja como contexto, pero no estructura el trabajo. Las capacidades se agregaron como tools y reglas de prompt, no como un núcleo operacional.

Señales concretas:

- `chat_sessions` y `localStorage` siguen siendo la navegación primaria del trabajo.
- `agent-prompt.ts` mezcla identidad, política, workflows, generación, retry, UX visual y reglas de dominio.
- `agent-tools.ts` creció como catálogo plano de capacidades heterogéneas.
- `audit_log_events` se usa también como read model para proactividad, cuando debería ser evidencia inmutable.
- RAG, knowledge graph, daily brief, historial de sesiones y patrones aprendidos compiten como memorias separadas.

## 2. Modelo mental objetivo

Modelo central:

```text
Empresa -> Obra -> Expediente Operativo -> Eventos / Evidencias / Acciones / Artefactos
```

La conversación no debe ser el contenedor principal. Debe ser un canal dentro de un expediente operativo.

Ejemplos de expedientes:

- Auditoría de presupuesto R4.
- Riesgo HSE de cuadrilla.
- Desvío de curva S de abril.
- Cierre de parte diario.
- Contradicción entre plano y presupuesto.
- Reprogramación por clima o suministros.

## 3. Separación de responsabilidades

### Conversación

Guarda mensajes, feedback y turnos del agente. Debe depender de un expediente (`work_case_id`) y no representar por sí sola el trabajo operativo.

### Contexto de obra

Estado actual de cronograma, HSE, acopios, finanzas, subcontratos, cobertura documental y alertas abiertas.

### Memoria empresarial

Patrones aprendidos, fuentes conectadas, entidades detectadas, relaciones empresa-obra-documento y criterios históricos de la constructora.

### Auditoría documental

Clasificación, extracción, hipótesis, evidencia, contradicciones, confianza y veredicto sobre documentos.

### Acciones operativas

Reprogramar, registrar HSE, registrar acopios, registrar subcontratos, resolver relaciones documentales, preparar/enviar comunicaciones.

### Generación documental

Presupuestos, informes, memorias, órdenes de compra y partes diarios como artefactos versionados, asociados a obra y expediente.

## 4. Entidades recomendadas

Primeras entidades a introducir:

- `work_cases`: expediente operativo por obra/empresa.
- `work_case_events`: bitácora del expediente.
- `work_case_evidence`: vínculos a archivos, chunks, relaciones y fuentes.
- `agent_runs`: cada ejecución del agente con modelo, tools, telemetría y prompt versionado.
- `operational_findings`: hallazgos vivos/accionables separados del audit log.
- `document_intelligence_reports`: clasificación, extracción, riesgos y confianza por documento.

Entidades de Contexto Empresarial futuro:

- `enterprise_sources`
- `enterprise_documents`
- `enterprise_entities`
- `enterprise_relations`
- `enterprise_sync_runs`

## 5. Capacidades del agente

El LLM no debería elegir entre decenas de tools pequeñas. El Agent Core debe exponer capacidades de mayor nivel y dejar funciones determinísticas como implementación interna.

Capacidades objetivo:

- `context.search`: RAG, graph, memoria empresarial y fuentes.
- `document.audit`: clasificación, extracción, contraste y veredicto.
- `budget.audit`: totales, cierres, incidencias, índices y comparativas.
- `project.brief`: brief operativo consolidado.
- `operations.update`: HSE, acopios, subcontratos, reprogramación.
- `documents.generate`: generación de artefactos.
- `communications.prepare/send`: comunicación con confirmación explícita.

Deberían volverse internas:

- Tools puramente visuales (`proyectar_*`, `generar_grafica`).
- Registro de hallazgos como bloque UI.
- Retry strategy, telemetry, plan/hypothesis parsing.
- Wrappers de generación que solo devuelven cards.

## 6. UX objetivo

La navegación principal debe ser:

```text
Empresa -> Obra -> Día / Expedientes / Documentos / Riesgos / Acciones
```

Cambios esperados:

- Reemplazar "Historial" por "Expedientes recientes" agrupados por obra.
- Cada obra debe mostrar estado vivo: riesgos abiertos, documentación faltante, acciones pendientes, últimos documentos y brief del día.
- El chat debe abrir dentro de una obra o expediente, no como conversación global.
- Las sesiones legacy quedan accesibles, pero no dominan la navegación.
- Cada respuesta importante debe poder explicar evidencia, tools usadas y evento de auditoría relacionado.

## 7. Prompt objetivo

El prompt debe bajar de una guía monolítica a módulos:

- Identidad e invariantes.
- Contexto actual de empresa/obra/expediente.
- Política de auditoría documental.
- Política de acciones operativas.
- Política de generación documental.
- Política de comunicación.
- Formato de salida.

El prompt runtime debe incluir solo los módulos relevantes para el caso. Las reglas mecánicas y visuales deben salir del prompt y vivir en código.

## 8. Plan de migración

### Fase 0 - Diagnóstico y deuda

- Inventariar tools, prompts, rutas y tablas actuales.
- Corregir bugs de integración y guards de multi-tenancy.
- Documentar este modelo como referencia del equipo.

### Fase 1 - Refactor mínimo sin romper comportamiento

- Crear `src/lib/agent-core/` con `context-builder`, `capability-registry`, `prompt-modules` y `run-metadata`.
- Mantener `/api/chat`, pero mover construcción de contexto y selección de tools fuera de la route.
- Versionar prompt/capacidades en `audit_log_events.payload` o `agent_runs`.

### Fase 2 - Expedientes operativos

- Agregar `work_cases`, `work_case_events` y `work_case_evidence`.
- Asociar nuevas conversaciones a expediente.
- Permitir expedientes por documento, riesgo, acción o brief.

### Fase 3 - Simplificación tools/prompt/UI

- Agrupar tools en capacidades de alto nivel.
- Convertir herramientas visuales en render interno.
- Modularizar prompt por caso de uso.
- Cambiar sidebar de sesiones a expedientes recientes.

### Fase 4 - Migración de legacy

- Crear expedientes legacy desde `chat_sessions` por `project_id`.
- Asociar mensajes, archivos y eventos cuando haya `fileId` o `__file_meta__`.
- Mantener compatibilidad de lectura antes de ocultar sesiones legacy.

### Fase 5 - Verificación

- Tests de multi-tenancy para `projectId`.
- Tests de integración de expediente con chat.
- Tests de generación y descarga de artefactos.
- Tests de audit trail por acción.
- Criterio UX: el usuario puede entrar por obra, abrir un expediente, ver evidencia, ejecutar una acción y revisar trazabilidad sin navegar sesiones sueltas.

## 9. Primer bloque de implementación

Bloque inicial recomendado para esta rama:

1. Validar `projectId` en rutas que lo reciben desde cliente.
2. Corregir render de documentos operativos generados.
3. Dejar este documento enlazado desde el índice.
4. Registrar handoff en `docs/AI_WORKLOG.md`.
5. Después, crear el skeleton de `agent-core` sin cambiar comportamiento.

Estado 2026-05-17:

- `projectId` ya se valida en `/api/upload` y `/api/sessions`.
- `MessageBubble` ya renderiza órdenes de compra y partes diarios generados.
- `src/lib/agent-core/` ya existe con tipos base, registry conceptual de capacidades, builder de scope y composición inicial de módulos de prompt.
- `/api/chat` ya calcula `agentCore.scope` y `capabilityIds` para logs/audit payload sin cambiar prompt efectivo ni tools.

Estado 2026-05-18:

- Expedientes operativos creados (`work_cases`, `work_case_events`, `work_case_evidence`) y nuevas sesiones asociadas server-side a `work_case_id`.
- `/api/chat` resuelve `workCaseId` desde `x-chat-session-id` y registra `work_case_events.chat.turn_completed` best-effort.
- `operational_findings` separa hallazgos vivos de `audit_log_events`.
- `/dashboard/obras/[id]` muestra expedientes operativos y permite abrir el chat vinculado.
- `/dashboard/obras/[id]/expedientes/[workCaseId]` muestra replay de eventos y evidencia expandible del expediente.
- Sesiones históricas con `project_id` migradas a `legacy_conversation` mediante `20260518002617_legacy-work-cases.sql`.
- `src/lib/agent-core/runtime.ts` concentra resolución de scope, prompt efectivo, tools bound y capabilities; `/api/chat` queda como orquestador.
- `agent_runs` registra cada ejecución del agente con modelo, tier, sesión, expediente, capabilities, usage y telemetría de tools; `/api/chat` vincula `agentRunId` al audit log y a `work_case_events.chat.turn_completed`.
- `PATCH /api/work-cases/[id]` habilita resolver/cerrar/reabrir expedientes con evento `work_case.status_changed`; la vista de expediente expone esas acciones sin cambiar prompt ni tools.
- `document_intelligence_reports` persiste reportes documentales por archivo con clasificación, extracción, riesgos, hallazgos, veredicto y confianza; upload los escribe best-effort y los vincula a `work_case_evidence.document_report` cuando hay expediente.
- Cierre de expediente con veredicto y resumen editables: migración `20260518190721_work-case-verdict-closure.sql` agrega `work_cases.verdict` (`approved`/`flagged`/`inconclusive`/`rejected`/`superseded`) y `closed_by_user_id`. `GET /api/work-cases/[id]` devuelve `documentReports[]` con `fileName` resuelto; `PATCH` acepta `verdict` + `summary` y registra `previousVerdict`/`verdict`/`summary`/`closedByUserId` en `work_case_events.work_case.status_changed`. La vista del expediente renderiza reportes documentales con clasificación/riesgos/hallazgos expandibles y abre un modal de cierre con selector de veredicto y resumen antes del estado terminal.
- Cierre agéntico de expediente: `proponer_cierre_expediente` permite al agente marcar `resolved` con `verdict`, `summary` y evidencia citable solo cuando el `workCaseId` viene del contexto validado. `createBoundTools()` inyecta `organization_id`/actor server-side y `closeWorkCaseFromAgent()` rechaza expedientes de otra organización o ya terminales.
- Vista global `/dashboard/expedientes`: lista expedientes de toda la organización, agrupa por `status` o `verdict`, permite búsqueda/filtro por estado y conserva accesos a detalle/chat cuando el expediente tiene obra/sesión asociada.

Plan de migración Agent Core cerrado para esta etapa. Próxima línea: avanzar con Contexto Empresarial o agregar detalle global para expedientes sin obra asociada.
