# AI Worklog - EdificIA

Registro corto para alternar entre Codex, Claude Code y otros agentes sin releer toda la historia del proyecto.

Reglas:

- Mantener entradas breves y accionables.
- Registrar solo cambios relevantes o handoffs con estado incompleto.
- No duplicar el roadmap ni el mapa de arquitectura.
- Incluir verificación ejecutada o explicar por qué no se ejecutó.
- Este archivo es **solo el handoff reciente**, no la historia completa. Cuando una entrada queda totalmente completada y reflejada en `ROADMAP.md` y `docs/04_architecture_map.md`, podarla de acá.

Dónde vive cada cosa:

- **Pendientes y prioridades vigentes** → `ROADMAP.md` (incluye §0 Pendientes externos).
- **Migraciones, rutas, tablas, scope, expedientes, contexto empresarial, alerting, proactividad, hitos por fecha** → `docs/04_architecture_map.md` (sección "Registro de Cambios Estructurales").
- **Modelo Empresa → Obra → Expediente → Evidencia y plan Agent Core** → `docs/08_agent_core_redesign.md`.
- **Capa de Contexto Empresarial (visión y conectores)** → `docs/06_enterprise_context_layer.md`.
- **Lectura agéntica de documentos** → `docs/07_agentic_document_reading.md`.
- **Explicación holística para humanos** → `docs/EXPLICACION_PROYECTO_PARA_VOS.md`.
- **Historia detallada de cambios** → `git log` + commits enlazados desde el ROADMAP.

Formato:

```md
## YYYY-MM-DD - Agente - Tarea corta

- Objetivo: ...
- Cambios: ...
- Archivos: `ruta/a.ts`, `ruta/b.tsx`
- Verificacion: `npm run type-check` OK / no ejecutado porque ...
- Pendiente: ...
```

---

## 2026-05-28 - Claude Code - Auditoría de estado (Opus 4.8)

- Objetivo: auditar el proyecto dejado por Opus 4.7 y registrar qué está mal y qué mejorar. Sin tocar código productivo.
- Cambios: nuevo `docs/09_auditoria_2026-05.md`. Verificación base OK (type-check/lint/test 85). Hallazgos 🔴: trabajo terminado sin commitear (estado real ≠ último commit, ROADMAP marca ✅ cosas solo en working tree), race conditions en `claim-founder`/`claim-invitation` (check-then-insert sin transacción), JWT sin verificación de firma local (delega 100% a InsForge), "Inteligencia Empresarial" sigue siendo fachada (sin conectores reales). 🟡: sin validación central de env, tests no cubren auth/tenancy/API, suppressions exhaustive-deps en chat/page, motor de proactividad dormido. 🟢: comentarios "Claude" obsoletos en file-processor, ROADMAP convertido en historial.
- Archivos: `docs/09_auditoria_2026-05.md`, `docs/AI_WORKLOG.md`.
- Verificacion: `npm run type-check` OK; `npm run lint` OK; `npm test` 85/85 OK.
- Pendiente: ninguno del audit en sí; las acciones recomendadas están priorizadas en `docs/09_auditoria_2026-05.md`.

## 2026-05-20 - Codex - Replanteo UX de Inteligencia y Expedientes

- Objetivo: mejorar el planteo y diseño de Inteligencia Empresarial y la Mesa de Expedientes sin cambiar contratos backend.
- Cambios: `/dashboard/contexto` pasa de "Radar" a "Centro de decisión empresarial", con lectura operativa, métricas de estado y próximo paso recomendado; tabs de Contexto ajustadas a Centro/Fuentes/Mapa Vivo. `/dashboard/expedientes` pasa de listado administrativo a Mesa de expedientes, con agrupación por bandeja operativa (`Para decidir`, `En gestión`, `Bloqueados o en espera`, `Cerrados`), métricas de decisión/trabajo/cierre y copy orientado a acción.
- Archivos: `src/app/dashboard/contexto/layout.tsx`, `src/app/dashboard/contexto/page.tsx`, `src/app/dashboard/expedientes/page.tsx`.
- Verificacion: `npm run type-check` OK; `npm run lint` OK.
- Pendiente: QA visual autenticado en navegador para validar densidad, contenido real y responsive.

## 2026-05-20 - Codex - QA visual de dashboard y bloques del agente

- Objetivo: mejorar la UI operativa completa y consolidar los 6 bloques visuales que puede emitir el agente.
- Cambios: headers y superficies ajustados en chat, obras, expedientes, contexto, fuentes, perfil, admin/errors y blocks-demo; bloques `metrics`, `media`, `comparison`, `timeline`, `risk_register` y `evidence_ledger` refinados para responsive/tokens; `MessageBubble` ahora renderiza `proyectar_riesgos` y `proyectar_evidencia` como bloques visuales especiales.
- Archivos: `src/app/dashboard/*`, `src/components/chat/blocks/*`, `src/components/chat/cards/FileCard.tsx`, `src/components/chat/cards/GeneratedDocCard.tsx`, `src/components/chat/MessageBubble.tsx`, `src/components/enterprise-context/EnterpriseSourcesPanel.tsx`, `docs/design/shadcn-blocks/manifest.json`, `docs/04_architecture_map.md`.
- Verificacion: `npm run type-check` OK; `npm run lint` OK; `npm test` OK (85/85); `npm run build` OK; dev server `http://localhost:3001` OK. Browser in-app no disponible por falta del canal `node_repl`/`mcp__node_repl__js`; QA HTTP confirmó redirects auth (`/dashboard/blocks-demo`, `/dashboard/contexto`, `/dashboard/admin/errors` -> `200 /login?next=...`).
- Pendiente: QA visual autenticado de `/dashboard/blocks-demo` y pantallas principales cuando haya sesión local en navegador.

## 2026-05-20 - Codex - Shadcn CLI y bloques operativos

- Objetivo: cerrar el pendiente de `docs/design/shadcn-blocks/` usando el CLI de shadcn sin meter bloques genéricos ni dependencias nuevas.
- Cambios: evaluado `@shadcn/dashboard-01` con `npx shadcn search/view/add --dry-run`; instalados primitives locales (`card`, `badge`, `tabs`, `table`, `select`, `dropdown-menu`, `tooltip`, `separator`, `skeleton`, `input`, `label`, `checkbox`, `sheet`, `avatar`); agregados bloques productivos `RiskRegisterBlock` y `EvidenceLedgerBlock` al contrato `BlockSpec`/`ResponseBlock` y a `/dashboard/blocks-demo`; manifest y notas de `docs/design/shadcn-blocks/` actualizados.
- Archivos: `src/components/ui/*`, `src/components/providers.tsx`, `src/lib/validators/blocks.ts`, `src/components/chat/blocks/RiskRegisterBlock.tsx`, `src/components/chat/blocks/EvidenceLedgerBlock.tsx`, `src/components/chat/blocks/index.tsx`, `src/components/chat/blocks/skeletons.tsx`, `src/components/chat/blocks/demo-data.ts`, `src/app/dashboard/blocks-demo/page.tsx`, `docs/design/shadcn-blocks/*`, `ROADMAP.md`, `docs/04_architecture_map.md`, `docs/AI_WORKLOG.md`.
- Verificacion: `npm run type-check` OK; `npm run lint` OK; `npm test` OK (85/85); `npm run build` OK; dev server en `http://localhost:3001` OK, `/dashboard/blocks-demo` redirige a login por auth (`307`, final `200 /login?next=...`).
- Pendiente: ver QA visual autenticado de `/dashboard/blocks-demo` en navegador cuando haya sesión local disponible.

---

## 2026-05-20 - Claude Code - Limpieza documental (full clean)

- Objetivo: dejar una sola narrativa documental vigente, sin docs duplicados/contradictorios ni pendientes mal encuadrados. Sin tocar código productivo.
- Cambios: archivados `docs/01_vision_and_stack.md` y `docs/02_phases_and_workflow.md` en `docs/archive/` (histórico); `docs/README.md` reescrito como índice canónico; `ROADMAP.md` suma §0 "Pendientes externos" (URL pública/schedule, conectores reales, credenciales) y el motor de proactividad pasa a ✅ con el schedule como pendiente externo; alineados `AGENTS.md`/`CLAUDE.md` (excepción `/api/seed-demo`, lectura de `docs/08`, Base Documental ahora vive dentro de Contexto Empresarial); neutralizadas menciones a Claude como proveedor (runtime = DeepSeek) en `ROADMAP.md`/`docs/04`/`docs/05`; `docs/05` re-encuadrado como visión no comprometida; fecha de `docs/04` actualizada y timeline reordenado.
- Archivos: `README.md`, `AGENTS.md`, `CLAUDE.md`, `ROADMAP.md`, `docs/README.md`, `docs/04_architecture_map.md`, `docs/05_future_roadmap.md`, `docs/archive/01_vision_and_stack.md`, `docs/archive/02_phases_and_workflow.md`, `docs/AI_WORKLOG.md`.
- Verificacion: `git diff --check` OK; sin cambios en código productivo.
- Pendiente: los comentarios "Claude multimodal" en `src/lib/file-processor/*` (zona estable, no tocados) describen el modelo viejo; conviene actualizarlos a "modelo multimodal" en una pasada de código aparte.

## 2026-05-20 - Codex - Indexación estructural enterprise

- Objetivo: mejorar la indexación real y cerrar pendientes internos (excepto URL pública/schedule).
- Cambios: nuevo `src/lib/rag/structure.ts` (resumen estructural de PDF/DOCX/Excel/DXF); chunks con `section_path`/`section_level`; `ingestDocument()` sincroniza cargas manuales con `enterprise_documents` y fuente `manual_upload`; el catálogo de Fuentes expone `documentStructure`.
- Archivos: `src/lib/rag/structure.ts`, `src/lib/rag/chunker.ts`, `src/lib/rag/ingest.ts`, `src/lib/enterprise-context/document-sync.ts`, `src/lib/enterprise-context/sources-service.ts`, `src/components/enterprise-context/EnterpriseSourceRegistry.tsx`, `src/lib/validators/api-responses.ts`, `tests/rag/structure.test.mjs`, `ROADMAP.md`, `docs/04_architecture_map.md`, `docs/06_enterprise_context_layer.md`.
- Verificacion: `npm run type-check` OK; `npm run lint` OK; `npm test` OK (85/85); `npm run build` OK.
- Pendiente: la bandeja `docs/design/shadcn-blocks/` queda lista para pegar bloques reales y registrarlos en `manifest.json`. Pendientes externos consolidados en `ROADMAP.md` §0.

---

## Antes de empezar una sesión nueva

1. Leer `ROADMAP.md` para confirmar prioridades (y §0 Pendientes externos).
2. Revisar el handoff más reciente de arriba.
3. Si una decisión arquitectónica cambió, actualizar `docs/04_architecture_map.md` y reflejarlo acá solo si afecta al próximo handoff.
4. Al cerrar el bloque: si el item quedó completado y documentado en ROADMAP + architecture map, no agregar entrada nueva acá. Si quedó algo abierto, sumar entrada breve siguiendo el formato de arriba.
