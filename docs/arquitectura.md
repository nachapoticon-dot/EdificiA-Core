# Arquitectura

Aplicación Next.js (App Router) monolítica: la UI y la API viven en el mismo
proyecto. InsForge provee Postgres, autenticación y Storage; Qdrant guarda los
vectores para la búsqueda semántica; DeepSeek es el modelo del agente.

## Capas

| Capa | Ubicación | Responsabilidad |
|---|---|---|
| Middleware | `src/proxy.ts` | Protege `/dashboard/*` por cookie, agrega `x-request-id`, aplica CORS a `/api/*`. |
| Rutas API | `src/app/api/**/route.ts` | Validan auth y rol, acotan cada consulta por `organization_id` y delegan en `src/lib`. |
| Agente | `src/lib/ai/` | Contexto del turno, prompt, tools, router de modelo, telemetría y registro de corridas. |
| Dominio | `src/lib/math-engine/`, `src/lib/indices/`, `src/lib/obra/`, `src/lib/work-cases/` | Cálculos de presupuesto, comparación con índices, cobertura documental por fase, expedientes. |
| Documentos | `src/lib/file-processor/`, `src/lib/excel/`, `src/lib/rag/`, `src/lib/documents/` | Parseo de archivos, fragmentación, embeddings, búsqueda y contraste con documentos previos. |
| Generación | `src/lib/export/` | Presupuesto `.xlsx`, memoria `.docx`, informe `.pdf`. |
| UI | `src/app/dashboard/`, `src/components/` | Chat, obras, expedientes, documentos y administración. |

## Multi-tenancy

- Cada usuario puede pertenecer a varias organizaciones (`organization_members`)
  con rol `admin`, `engineer` o `viewer`. La organización activa viaja en el
  header `x-org-id`; `requireAuth()` valida el token contra InsForge y verifica
  la membresía.
- El servidor usa la service role key de InsForge, así que el aislamiento lo
  garantiza el código: todas las consultas filtran por `organization_id`.
- Las tools del agente reciben la organización y el usuario por closure
  (`createAgentTools(orgId, userId)`); el modelo nunca los ve como parámetro.

## Turno de chat

1. El cliente adjunta archivos vía `POST /api/upload`. El archivo se parsea, se
   guarda en el bucket `presupuestos`, se escanea en busca de datos personales
   y se compara contra documentos previos de la obra (`context-scan`). En
   segundo plano se fragmenta e indexa (Qdrant y `document_chunks`). Los ítems
   de un Excel quedan en un caché en memoria de 2 h, referenciados por `cacheId`.
2. `POST /api/chat` resuelve obra, sesión y expediente (`runtime.ts`), elige el
   modelo según señales del mensaje (`model-router.ts`) y llama a `streamText`
   con un presupuesto de 20 pasos (35 en el tier "deep").
3. Al terminar se registran `agent_runs`, un evento en el expediente y una fila
   en el audit log.

## Búsqueda documental

`searchDocuments()` corre en paralelo búsqueda vectorial (Qdrant, embeddings
`baai/bge-m3` de 1024 dimensiones vía NVIDIA NIM) y full-text en Postgres, y
fusiona los resultados. Sin `NVIDIA_API_KEY` o sin Qdrant queda solo la parte
full-text. El estado de indexación de cada archivo (`indexed`, `degraded`,
`failed`) se ve en `/dashboard/documents`.

## Datos

`migrations/` contiene las migraciones que aplica el CLI de InsForge. Asumen un
esquema base que está en `db/base-schema/` (SQL histórico, 001–016). Algunas
migraciones crean tablas de módulos que ya no existen en el código; se
conservan porque están aplicadas en la base existente.

Tablas principales: `organizations`, `organization_members`, `projects`,
`uploaded_files`, `document_chunks`, `project_phase_docs`, `price_indices`,
`chat_sessions`, `chat_snapshots`, `organization_invitations`,
`org_founder_invitations`, `work_cases`, `work_case_events`,
`agent_runs`, `audit_log_events`, `app_error_events`.
