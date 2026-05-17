# Mapa de Arquitectura y Dependencias (Repo Map)

> **Última actualización**: 2026-05-17 (Agent Core + organización por dominios)

Este documento contiene el mapa estructural del proyecto. 
**Regla para la IA**: Cada vez que crees un módulo nuevo (Frontend, Backend, Database), DEBES actualizar este grafo. Antes de modificar código existente, lee este grafo para entender qué otras partes del sistema vas a afectar y evitar romper el código.

## ✅ Estado de Auth (arreglado)

> **Proxy real**: `src/proxy.ts` protege `/dashboard/*` y redirige a `/login` si no hay cookie `edificia_session`. Redirige también de `/login` → `/dashboard/chat` o `/register` → `/dashboard/chat` si ya hay sesión activa. También responde preflight CORS para `/api/*`.
>
> **Verificación JWT**: `verifyUserId()` en `src/lib/auth/jwt.ts` valida el token contra `${INSFORGE_URL}/auth/v1/user` server-side (cache 60 s). ⚠️ **Fallback peligroso**: si InsForge no responde, acepta el JWT sin verificar firma. Pendiente: agregar `AUTH_STRICT_MODE` para producción.
>
> **Función centralizada**: `requireAuth(req, opts?)` en `src/lib/auth/require-auth.ts` extrae token, verifica, resuelve org membership. Los 18 route handlers la usan.
>
> **Sesión persistente**: token en `localStorage` + cookie `edificia_session` (7 días). Sobrevive cierre de pestaña/navegador. Logout limpia ambos.
>
> **Rutas excluidas de auth**: `/api/health`, `/api/auth/register`, `/api/seed-demo`, `/api/super-admin/*` (auth propia con SUPER_ADMIN_KEY).

```mermaid
graph TD
    %% Entidades externas
    User[Usuario / Ingeniero]

    %% Auth Flow
    LoginPage[Login Page\nsrc/app/auth/login]
    AuthLayout[Auth Layout\nsrc/app/auth/layout.tsx]

    %% Dashboard
    ChatUI[Next.js Chat UI\nsrc/app/dashboard/chat]
    ChatAPI[API Route /api/chat\nsrc/app/api/chat/route.ts]

    %% AI
    AI_Agent[Vercel AI SDK Agent\nsrc/lib/ai/agent.ts]

    %% InsForge
    BrowserClient[InsForge Browser Client\nsrc/lib/insforge/client.ts]
    AdminClient[InsForge Admin Client\nsrc/lib/insforge/server.ts]
    InsForgeBackend[InsForge BaaS\nhttps://daw63k5s.us-east.insforge.app]

    %% DB
    DB[(PostgreSQL RLS\norganizations · organization_members\nprojects · uploaded_files\nchat_sessions · document_chunks\norg_founder_invitations\ncompany_learned_patterns\nproject_phase_docs\naudit_log_events\nproject_schedule_tasks · project_financial_snapshots\nproject_subcontracts · project_hse_records · project_supply_items)]

    %% Qdrant
    Qdrant[(Qdrant Cloud\nVector DB para RAG)]

    %% Tools
    Parser[File Processor\nsrc/lib/file-processor/]
    RAG[RAG Engine\nsrc/lib/rag/]

    %% Validators
    Validators[Zod Schemas\nsrc/lib/validators/]

    %% Projects API
    ProjectsAPI[API Route /api/projects\nsrc/app/api/projects/route.ts]
    useProjects[useProjects hook\nTanStack Query + localStorage activeId]

    %% Super Admin
    SuperAdmin[Super Admin Panel\nsrc/app/super-admin/page.tsx\nAuth propia con SUPER_ADMIN_KEY]

    %% Conexiones Auth (middleware real + cookie de sesión)
    User -- "GET /login" --> LoginPage
    LoginPage -- "signInWithPassword" --> BrowserClient
    BrowserClient -- "Auth API" --> InsForgeBackend
    InsForgeBackend -. "Token → localStorage\n+ cookie edificia_session" .-> LoginPage

    %% Conexiones Chat
    User -- "Sube Archivos / Pregunta" --> ChatUI
    ChatUI -- "POST /api/chat" --> ChatAPI
    ChatAPI -- "streamText + tools" --> AI_Agent
    AI_Agent -- "Tool: buscar_en_base_documental" --> RAG
    RAG -- "Semantic search" --> Qdrant
    AI_Agent -- "Tool: Procesar archivo" --> Parser

    %% Projects
    ChatUI -- "useProjects" --> useProjects
    useProjects -- "GET/POST" --> ProjectsAPI
    ProjectsAPI -- "admin client" --> AdminClient

    %% DB
    AdminClient -- "Queries con service role" --> InsForgeBackend
    InsForgeBackend -- "PostgREST" --> DB

    %% Super Admin (independiente)
    SuperAdmin -- "Bearer SUPER_ADMIN_KEY" --> AdminClient
```

## Stack de Dependencias (2026-05-13)

| Paquete | Versión | Rol |
|---|---|---|
| next | ^16.2.4 | Framework Frontend + API Routes |
| react | ^19.0.0 | UI Runtime |
| typescript | ^5 | Tipado estricto E2E |
| tailwindcss | ^4 | Estilos utility-first |
| shadcn | ^4.6.0 | Componentes UI premium |
| @tanstack/react-query | ^5.74.4 | Data fetching / cache del cliente |
| zod | ^3.24.3 | Validación de schemas E2E |
| @insforge/sdk | ^1.2.5 | BaaS client — auth, database, storage |
| ai | ^6.0.168 | Vercel AI SDK — streaming + tools |
| @ai-sdk/openai | ^3.0.62 | Provider OpenAI-compatible (DeepSeek) |
| @ai-sdk/openai-compatible | ^2.0.46 | NVIDIA NIM embeddings |
| @ai-sdk/react | ^3.0.171 | React hooks (useChat) |
| @qdrant/js-client-rest | ^1.17.0 | Qdrant vector DB client |
| pino | ^10.3.1 | Logger estructurado |
| framer-motion | ^12.38.0 | Animaciones |
| lucide-react | ^1.12.0 | Iconos |
| next-themes | ^0.4.6 | Dark/Light mode |
| recharts | ^3.8.1 | Gráficos |
| resend | ^6.12.2 | Email transaccional |
| xlsx | ^0.18.5 | Excel parser |
| pdf-parse | ^2.4.5 | PDF parser |
| mammoth | ^1.12.0 | DOCX parser |
| dxf-parser | ^1.1.2 | DXF parser |
| dxf-viewer | ^1.0.47 | DXF WebGL viewer |
| docx | ^9.6.1 | DOCX generator |
| jspdf + jspdf-autotable | ^4.2.1 | PDF generator |
| react-markdown + remark-gfm | ^10.1.0 | Markdown rendering |

## Estructura de Carpetas (`src/`) — Actual

```
src/
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx              → Layout centrado para auth
│   │   ├── login/page.tsx          → Formulario de login
│   │   └── register/page.tsx       → Formulario de registro (2 pasos: verificar email → completar)
│   ├── dashboard/
│   │   ├── layout.tsx              → Dashboard layout (sidebar + providers)
│   │   ├── chat/page.tsx           → Chat principal con el agente
│   │   ├── obras/[id]/page.tsx     → Detalle de obra
│   │   ├── obras/[id]/today/page.tsx → Día en la obra
│   │   ├── documents/              → Base documental (pendiente)
│   │   └── admin/settings/         → Config admin empresa
│   ├── super-admin/
│   │   └── page.tsx                → Panel super admin (auth propia, NO middleware)
│   ├── api/
│   │   ├── auth/
│   │   │   ├── me/route.ts         → GET perfil usuario + org + branding
│   │   │   ├── register/route.ts   → POST registro + GET verificar email
│   │   │   ├── claim-founder/route.ts → POST crear org al login de fundador
│   │   │   ├── logout/route.ts     → POST logout
│   │   │   └── orgs/route.ts       → GET organizaciones del usuario
│   │   ├── chat/route.ts           → POST streaming chat (DeepSeek + tools)
│   │   ├── upload/route.ts         → POST subir archivo + RAG ingest
│   │   ├── cron/
│   │   │   └── project-proactivity/route.ts → CRON con secreto: scanner diario de riesgos de obra
│   │   ├── projects/
│   │   │   ├── route.ts            → GET/POST proyectos
│   │   │   └── [id]/
│   │   │       ├── route.ts        → PATCH/DELETE proyecto
│   │   │       ├── files/route.ts  → GET archivos del proyecto
│   │   │       └── daily-brief/route.ts → GET brief diario operativo de obra
│   │   ├── documents/
│   │   │   ├── route.ts            → GET/DELETE documentos
│   │   │   ├── save/route.ts       → POST guardar documento
│   │   │   └── [id]/route.ts       → GET documento por ID
│   │   ├── sessions/
│   │   │   ├── route.ts            → GET/POST/DELETE sesiones de chat
│   │   │   └── [id]/messages/route.ts → GET/POST mensajes de sesión
│   │   ├── generate/
│   │   │   ├── presupuesto/route.ts → POST generar presupuesto
│   │   │   ├── memoria/route.ts     → POST generar memoria técnica
│   │   │   └── informe/route.ts     → POST generar informe
│   │   ├── indices/
│   │   │   ├── route.ts            → GET índices de precios
│   │   │   └── upload/route.ts     → POST subir índice
│   │   ├── admin/
│   │   │   ├── settings/route.ts   → GET/PATCH config organización
│   │   │   ├── members/route.ts    → GET/POST/DELETE miembros
│   │   │   └── patterns/route.ts   → GET patrones aprendidos
│   │   ├── super-admin/
│   │   │   ├── founders/route.ts   → GET/POST/DELETE invitaciones fundador
│   │   │   ├── companies/route.ts  → GET/PATCH empresas
│   │   │   └── reset/route.ts      → POST reset completo
│   │   ├── health/route.ts         → GET health check (público)
│   │   └── seed-demo/route.ts      → POST seed datos demo
│   ├── layout.tsx                  → Root layout (fonts, providers)
│   ├── page.tsx                    → Redirect a /dashboard/chat
│   └── globals.css                 → Variables CSS + Tailwind v4
├── components/
│   ├── chat/
│   │   ├── AgentGreeting.tsx       → Saludo del agente
│   │   ├── DxfViewerModal.tsx      → Visor WebGL de planos DXF
│   │   ├── MessageBubble.tsx       → Burbuja de mensaje en el chat
│   │   ├── ProactivityAlertsBanner.tsx → Banner de hallazgos proactivos
│   │   ├── input/                  → ChatInput + DropZone
│   │   ├── sidebar/                → Navegación, org, usuario, sesiones y obra activa
│   │   ├── cards/                  → Cards de archivos, planes, hipótesis, documentos y hallazgos
│   │   └── blocks/                 → Bloques visuales estructurados del agente
│   ├── obras/
│   │   └── ProjectCard.tsx         → Card de proyecto en listado
│   ├── providers.tsx               → QueryClientProvider + ThemeProvider
│   └── ui/                         → Componentes Shadcn (auto-generados)
├── contexts/
│   ├── SessionContext.tsx          → Contexto de sesión de chat
│   └── ProjectContext.tsx          → Contexto de proyecto activo
├── hooks/
│   ├── useCurrentUser.ts           → Usuario autenticado (InsForge SDK)
│   ├── useOrgs.ts                  → Organizaciones del usuario
│   ├── useOrgMember.ts             → Membership + branding
│   ├── useProjects.ts              → CRUD de proyectos
│   ├── useProjectDetails.ts        → Detalle de obra activa
│   ├── useDailyProjectBrief.ts     → Brief diario de cronograma, HSE, acopios, finanzas, alertas y clima
│   ├── useProjectCoverage.ts       → Cobertura documental de obra
│   ├── useProjectFiles.ts          → Archivos de un proyecto
│   ├── usePriceIndices.ts          → Índices de precios
│   ├── useSessionHistory.ts        → Historial de sesiones
│   └── useMessageHistory.ts        → Mensajes de una sesión
├── lib/
│   ├── auth/
│   │   ├── jwt.ts                  → Verificación JWT con InsForge + fallback decode-only
│   │   ├── require-auth.ts         → Guard centralizado para API routes (auth + org + role)
│   │   └── reset-token.ts          → HMAC-SHA256 tokens para password reset
│   ├── audit/
│   │   └── audit-log.ts            → Writer server-side de eventos append-only
│   ├── agent-core/
│   │   ├── types.ts                → Tipos base para scope, expediente operativo y capacidades
│   │   ├── context-builder.ts      → Builder puro del scope Empresa/Obra/Expediente
│   │   ├── capability-registry.ts  → Registro conceptual de capacidades del Agent Core
│   │   └── prompt-modules.ts       → Composición modular futura del prompt
│   ├── api/
│   │   ├── errors.ts               → Helpers de error estandarizados
│   │   └── rate-limit.ts           → Rate limiter in-memory
│   ├── insforge/
│   │   ├── client.ts               → Browser client (token en localStorage + cookie edificia_session)
│   │   └── server.ts               → Admin client (service role key)
│   ├── ai/
│   │   ├── agent.ts                → Config del agente + system prompt
│   │   ├── agent-tools.ts          → Tools sin org-binding
│   │   ├── agent-tools-bound.ts    → Tools con org-id servidor-verificado
│   │   ├── model-router.ts         → Selección fast/deep por señales del turno
│   │   ├── output/                 → Parsers de salida del agente (ej. hipótesis)
│   │   ├── observability/          → Telemetría de tools y runtime
│   │   └── session-learner.ts      → Aprendizaje de patrones post-sesión
│   ├── rag/
│   │   ├── ingest.ts               → Ingesta de documentos a Qdrant
│   │   └── search.ts               → Búsqueda semántica en Qdrant
│   ├── obra/
│   │   ├── phases.ts               → Detección de fase de obra
│   │   └── coverage.ts             → Cálculo de cobertura documental
│   ├── indices/
│   │   ├── query.ts                → Queries de índices de precios
│   │   └── compare.ts              → Comparación de índices
│   ├── weather/
│   │   └── open-meteo.ts           → Forecast Open-Meteo + impacto operativo de clima
│   ├── document-intelligence/
│   │   └── context-scan.ts         → Detección heurística de contradicciones al subir
│   ├── proactivity/
│   │   └── daily-scan.ts           → Scanner diario de riesgos sobre obras activas
│   ├── project-operations/
│   │   ├── agent-writers/          → Writers invocados por tools del agente
│   │   ├── brief/                  → Agregadores operativos diarios
│   │   ├── communications/         → Emails y comunicaciones a stakeholders
│   │   ├── contracts/              → Registro y auditoría de subcontratos
│   │   ├── supplies/               → Helpers de acopios y suministros
│   │   ├── financial-curve.ts      → Auditoría de curva S
│   │   ├── personnel.ts            → Verificación HSE de cuadrillas/personas
│   │   └── schedule.ts             → Reprogramación auditada de tareas
│   ├── excel/
│   │   └── parser.ts               → Parser de Excel (separado del file-processor)
│   ├── pattern-extractor/          → Extractor de patrones de archivos
│   ├── file-processor/             → Procesador multimodal de archivos
│   ├── file-cache.ts               → Cache de items de Excel
│   ├── logger.ts                   → Logger estructurado (Pino)
│   ├── validators/
│   │   ├── index.ts                → Schemas Zod compartidos (login, signUp, tenant)
│   │   ├── api-responses.ts        → Contratos Zod de responses API consumidas por frontend
│   │   └── blocks.ts               → Schemas Zod de los bloques de UI Generativa
│   └── utils.ts                    → Utilidades (cn, etc.)

tests/
    ├── agent/                      → Agent Core, router y observabilidad del agente
    ├── chat/                       → Parsers/render helpers del chat
    ├── documents/                  → Excel y generación documental
    ├── math/                       → Motor matemático
    ├── project-operations/         → Cronograma y writers operativos
    ├── register-ts-loader.mjs      → Loader TS para node:test
    └── ts-resolve-loader.mjs       → Resolución de aliases en tests

migrations/ (canónico, InsForge CLI)
    ├── 20260507195853_catchup-missing-columns.sql
    ├── 20260513215703_project-metadata.sql
    ├── 20260513220428_security-fixes.sql
    ├── 20260515032815_add-founder-columns.sql
    ├── 20260516140000_immutable-audit-log.sql
    └── 20260516215250_project-operations-schema.sql

docs/archive/db-migrations-legacy/
    └── 001..016_*.sql              → histórico raw SQL previo; read-only, no usar para cambios nuevos
```

## Esquema Operativo de Obra

La arquitectura extendida de obra vive en PostgreSQL/RLS y queda preparada para CRON/workers y tools del agente. Todas las tablas tienen `organization_id`, `project_id`, soft-delete, `metadata JSONB`, timestamps e índices por organización/obra.

| Tabla | Propósito |
|---|---|
| `project_schedule_tasks` | Cronograma real: tareas, fechas, progreso, bloqueo y predecesoras. |
| `project_financial_snapshots` | Curva S y avance económico: planificado, real, comprometido, facturado y pagado. |
| `project_subcontracts` | Directorio de subcontratos por obra: rubro, monto, estado, contacto y retenciones. |
| `project_hse_records` | HSE/legales: ART, EPP, capacitaciones, aptos médicos, incidentes y accesos. |
| `project_supply_items` | Acopios y suministros: cantidades requeridas/pedidas/recibidas, proveedor, costo y fecha requerida. |

RLS: miembros de la organización leen; `admin` y `engineer` insertan/actualizan; solo `admin` puede borrar. El rol interno `project_admin` conserva acceso total para operaciones de backend. `projects.status` queda normalizado a `en_obra`, `planificacion`, `finalizado`, `pausado`.

## Registro de Cambios Estructurales

| Fecha | Sprint | Cambio |
|---|---|---|
| 2026-04-28 | Sprint 0 | Scaffold inicial: Next.js 16 + TS strict + Shadcn + Vercel AI SDK v6 + TanStack Query + Zod |
| 2026-04-29 | Sprint 1 | Auth flow: InsForge client (browser + admin), login form, schema PostgreSQL con RLS multi-tenant |
| 2026-04-29 | Sprint 1.5 | DB hardening: 14 indexes, soft deletes, RLS fixes, organization_invitations + audit_results |
| 2026-04-29 | Sprint 2 | Chat UI + Motor Matemático: AI agent con tools, API route streamText, dashboard layout + chat page |
| 2026-04-29 | Sprint 3 | Excel Upload + Parser: xlsx parser, /api/upload con InsForge storage, DropZone drag-and-drop |
| 2026-04-29 | Sprint 3.5 | Universal File Processor: PDF, DXF, DOCX, Imágenes (Claude multimodal), DWG (rechazado con guía) |
| 2026-04-29 | Rebrand | "Gemini Construcción" → "EdificIA". SYSTEM_PROMPT optimizado. v0.4.0 |
| 2026-04-29 | Sprint 4 | QoL: Dark/Light mode, Session History sidebar, auto-registro de sesión |
| 2026-04-29 | Sprint 7 | Persistencia de conversaciones: useMessageHistory, SessionContext, auto-save |
| 2026-04-29 | Sprint 9 | Visor DXF WebGL: dxf-viewer + Three.js, DxfViewerModal |
| 2026-05-01 | Sprint 17 | Proyecto activo: useProjects migrado a TanStack Query + API, contexto de proyecto en prompt |
| 2026-05-13 | Profesionalización | Purga de Ruflo, logger Pino, rate limiter, error helpers, validadores Zod, Super Admin panel completo, OrganizationCard, ActiveProjectSection, security fixes, migraciones 012-014 |
| 2026-05-13 | Fix | Removido `/super-admin` de rutas protegidas del proxy (bloqueaba acceso al panel) |
| 2026-05-13 | Limpieza | Auditoría de 133+ archivos: eliminados archivos muertos (OrgSwitcher.tsx, demo-data.ts, scripts debug, .mcp.json, .claude-flow/, zip raíz) |
| 2026-05-14 | Seguridad | Fix completo de auth: proxy/middleware real, requireAuth() centralizado, verifyUserId vía InsForge, localStorage+cookie, logout limpio. 18 routes refactorizadas. |
| 2026-05-16 | Corrección docs | `src/proxy.ts` confirmado como guard activo de dashboard + CORS. Referencias obsoletas a `src/middleware.ts` corregidas. |
| 2026-05-16 | Contratos API | Agregado `src/lib/validators/api-responses.ts` para validar responses críticas (`upload`, `auth/me`, `projects`, `sessions`) en route handlers y clientes. |
| 2026-05-16 | Audit log | Agregado `audit_log_events` append-only con hash encadenado, RLS de lectura por org y triggers anti-update/delete; `upload` y `chat` registran eventos server-side. |
| 2026-05-16 | Migraciones | `migrations/` queda como ruta canónica vía InsForge CLI. `db/migrations/` se archivó en `docs/archive/db-migrations-legacy/` y Docker dejó de ejecutar migraciones raw SQL al arrancar. |
| 2026-05-16 | Inteligencia documental | Agregado `src/lib/document-intelligence/context-scan.ts` para advertir contradicciones numéricas contra documentos previos al subir archivos. |
| 2026-05-16 | Dominio de obra | Agregadas tablas operativas `project_schedule_tasks`, `project_financial_snapshots`, `project_subcontracts`, `project_hse_records` y `project_supply_items` con RLS por organización. |
| 2026-05-16 | Proactividad | Agregado `runDailyProjectScan()` y `/api/cron/project-proactivity` para detectar riesgos diarios y escribir resumen en `audit_log_events`; schedule externo pendiente de URL pública. |
| 2026-05-16 | Clima | Agregada tool `evaluar_impacto_clima` con Open-Meteo para forecast diario y riesgo operativo por lluvia, viento y temperatura. |
| 2026-05-17 | Día en la obra | Agregado `buildDailyBrief()`, `GET /api/projects/[id]/daily-brief`, `useDailyProjectBrief()` y `/dashboard/obras/[id]/today` para consolidar cronograma, HSE, acopios, finanzas, alertas y clima. |
| 2026-05-17 | Subcontratos | Agregado `src/lib/project-operations/contracts/subcontracts.ts` y tools `registrar_subcontrato` / `auditar_subcontratos` para gestión contractual y retenciones. |
| 2026-05-17 | Organización por dominios | Helpers nuevos del agente y operaciones de obra movidos a subcarpetas por responsabilidad (`ai/output`, `ai/observability`, `project-operations/{brief,communications,contracts,supplies,agent-writers}`); tests agrupados por dominio. |
| 2026-05-14 | Auditoría | Verificación de planes contra código. Corregidos CLAUDE.md, README (DeepSeek no Claude), PLAN_DE_MEJORA, TAREAS_CLAUDE, PLAN_FLUJO_EMPRESAS. Branding unificado a EdificIA. |
