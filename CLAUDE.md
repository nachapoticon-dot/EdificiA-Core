# EdificIA — Contexto para Claude Code

EdificIA es un **Sistema de Operaciones Autónomo para la Construcción**. El agente IA actúa como *Project Manager Digital* para constructoras argentinas. Multi-tenant estricto.

---

## 1 · Comportamiento del agente

### Flujo de trabajo obligatorio

1. **Leer antes de actuar.** Antes de proponer o escribir código, leer los archivos involucrados. No asumir contenido.
2. **Verificar tareas activas.** Al inicio de cada sesión, leer `ROADMAP.md` (raíz) para saber qué hay pendiente y la prioridad sugerida.
3. **Preguntar ante ambigüedad.** Si una instrucción admite más de una interpretación, preguntar. No inventar requerimientos.
4. **Un cambio, un propósito.** Cada edición debe resolver exactamente lo que se pidió. No refactorizar "de paso", no mejorar nombres, no reordenar imports, a menos que se pida explícitamente.
5. **Probar lo que se toca.** Después de cada cambio, verificar que compila (`npm run type-check`) si es un cambio de tipos, o validar lógica si es runtime. Reportar resultado.

### Comunicación

- Responder en **español** (el idioma del equipo).
- Ser directo. Ir al punto sin rodeos ni explicaciones innecesarias.
- Al terminar una tarea, dar un resumen breve: qué se hizo, qué archivos se tocaron, y si quedó algo pendiente.
- No repetir contexto que ya se dio. Si el usuario ya explicó algo, no parafrasearlo de vuelta.

### Coordinación con Codex

- Codex usa `AGENTS.md` como guía operativa equivalente a este archivo.
- Al terminar una tarea relevante o dejar trabajo incompleto, agregar una entrada breve en `docs/AI_WORKLOG.md`.
- Si se modifica una regla crítica en `CLAUDE.md` (auth, multi-tenancy, edición, verificación, prioridades), evaluar si también debe reflejarse en `AGENTS.md`.
- Antes de retomar una tarea iniciada por otro agente, revisar `docs/AI_WORKLOG.md`.

### Toma de decisiones

- **Priorizar lo simple y lo existente.** Usar las librerías que ya están en `package.json` antes de proponer nuevas.
- **No instalar dependencias sin autorización.**
- **Seguir las convenciones existentes.** Mirar archivos vecinos para copiar patrones (naming, imports, estructura).
- Si se detecta un bug no relacionado con la tarea actual, **reportarlo pero no arreglarlo** a menos que se pida.

---

## 2 · Economía de tokens — reglas de eficiencia

> Estas reglas reducen gasto de tokens y mejoran la velocidad de respuesta.

| Regla | Detalle |
|-------|---------|
| **Lectura incremental** | No leer archivos enteros si solo se necesita una sección. Usar rangos de líneas (`StartLine`/`EndLine`). |
| **Ediciones quirúrgicas** | Editar solo las líneas que cambian. Nunca reescribir un archivo completo para cambiar una función. |
| **No repetir código** | No copiar el archivo entero en la respuesta. Mostrar solo el diff o las líneas relevantes. |
| **Respuestas cortas** | Evitar explicaciones extensas. Si el cambio es obvio, basta con: "Hecho. Se cambió X en `archivo.ts:42`." |
| **Agrupar ediciones** | Si hay múltiples cambios en un archivo, hacerlos en una sola operación multi-edit en vez de varias individuales. |
| **No recapitular** | No resumir lo que el usuario acaba de decir. No repetir el contexto del proyecto al inicio de cada respuesta. |
| **Evitar búsquedas amplias** | Usar `grep` con paths específicos, no buscar en todo el proyecto. Filtrar por extensión (`*.ts`, `*.tsx`). |
| **Un solo plan** | No presentar múltiples opciones salvo que se pidan. Ir con la mejor solución directamente. |

---

## 3 · Stack real (lo que usa el código)

| Capa | Tecnología | Archivo clave |
|------|-----------|---------------|
| Framework | Next.js 16 (App Router) + TypeScript strict | `next.config.ts` |
| Modelo AI | **DeepSeek** vía OpenAI-compatible SDK | `src/app/api/chat/route.ts` |
| Embeddings | NVIDIA NIM (`text-embedding-3-small`) | `src/lib/embeddings/index.ts` |
| BaaS | InsForge (auth, DB, storage) | `src/lib/insforge/server.ts` (admin) · `client.ts` (browser) |
| Vector DB | Qdrant | `src/lib/qdrant/client.ts` |
| DB | PostgreSQL con RLS multi-tenant | `db/migrations/` (14 archivos) |
| Validación | Zod v3 | `src/lib/validators/` |
| Email | Resend | `src/lib/email/resend.ts` |
| UI | Shadcn + Tailwind v4 + Framer Motion | `src/components/` |

## 4 · Autenticación — Cómo funciona

1. **Proxy / Middleware** (`src/proxy.ts`): Protege `/dashboard/*`. Lee cookie `edificia_session`, valida JWT localmente, redirige a `/login` si no hay sesión. También maneja CORS para `/api/*`.
2. **API routes**: Usan `requireAuth(req)` de `src/lib/auth/require-auth.ts`. Extrae Bearer token, verifica contra InsForge, resuelve org membership.
3. **Cliente**: `getAuthToken()` en `src/lib/insforge/client.ts` maneja refresh automático del token.
4. **Roles**: `admin` | `engineer` | `viewer`. Los admins acceden a `/api/admin/*`. Los viewers solo chatean.

> ⚠️ **NO crear rutas de API sin `requireAuth()`**. Excepción: `/api/health`, `/api/auth/register`, `/api/super-admin/*` (auth propia con `SUPER_ADMIN_KEY`).

## 5 · Multi-tenancy — Regla absoluta

Toda query a la DB o Qdrant **DEBE** filtrar por `organization_id` (derivado de `auth.orgId`). Columna real: `organization_id`, **NO** `company_id`. Jamás asumir que los datos pueden cruzarse entre orgs.

## 6 · Estructura principal

```
src/
├── app/api/          → 31 API routes (auth, chat, upload, projects, documents, admin, super-admin, etc.)
├── app/dashboard/    → Chat principal, obras/[id], documents, admin, blocks-demo
├── app/(auth)/       → Login, registro, forgot/reset password
├── components/chat/  → ChatInput, MessageBubble, FileCard, DropZone, DxfViewerModal, bloques UI generativa
├── hooks/            → useProjects, useOrgMember, useOrgs, useSessionHistory, useProjectDetails, etc.
├── contexts/         → SessionContext, ProjectContext
├── lib/ai/           → agent-prompt.ts (system prompt), agent-tools.ts (definiciones), agent-tools-bound.ts (con org-binding)
├── lib/rag/          → ingest.ts, search.ts (búsqueda híbrida: semántica + FTS + ilike)
├── lib/auth/         → jwt.ts, require-auth.ts, reset-token.ts
├── lib/file-processor/ → PDF, Excel, DXF, DOCX, imagen
├── lib/export/       → Generadores de PDF (jsPDF), DOCX, XLSX
└── lib/api/          → errors.ts (helpers estandarizados), rate-limit.ts
```

## 7 · Documentación de planificación

**ANTES de proponer cambios arquitectónicos, leer estos archivos:**

| Archivo | Cuándo leerlo |
|---------|---------------|
| `ROADMAP.md` (raíz) | **Siempre al inicio**. Pendientes, mejoras estratégicas y orden recomendado. |
| `docs/04_architecture_map.md` | Para ver el grafo de dependencias y el stack de paquetes. |
| `docs/03_domain_knowledge.md` | Antes de tocar lógica de auditoría / dominio de obra. |
| `docs/06_enterprise_context_layer.md` | Antes de diseñar Base Documental, conectores, RAG empresarial o auditoría transversal. |
| `docs/07_agentic_document_reading.md` | Antes de modificar prompt, tools de documentos o UX de auditoría. |

## 7.1 · Decisiones de producto vigentes

1. **Base Documental evoluciona a Contexto Empresarial.** EdificIA no debe pensarse como un repositorio de archivos subidos. Debe conectarse de forma segura y principalmente de solo lectura a fuentes reales de la constructora, construir contexto de empresa, detectar obras activas, clasificar documentos y habilitar auditoría transversal. Ver `docs/06_enterprise_context_layer.md`.
2. **Lectura agéntica de documentos.** El agente no debe comportarse como pipeline hardcodeado de tools. Debe clasificar, formar hipótesis, extraer señales, contrastar con contexto, verificar con tools y sintetizar hechos/riesgos/inferencias. Ver `docs/07_agentic_document_reading.md`.
3. **Las tools son instrumentos, no el razonamiento.** No diseñar UX ni prompts que digan "ejecutando 9 reglas" o expongan mecánicas internas como si fueran el producto.

## 8 · Reglas de código

1. **TypeScript estricto**. Validar con Zod. No usar `any` sin justificación.
2. **Ediciones quirúrgicas**: No reescribir archivos enteros si solo cambia una función.
3. **No instalar dependencias** sin autorización. Priorizar lo que ya está: Vercel AI SDK, xlsx, pdf-parse, jsPDF, mammoth, dxf-parser.
4. **UI Generativa**: Bloques visuales bajo `src/components/chat/blocks/`. No imprimir tablas en Markdown cuando existe un bloque.
5. **Identidad**: Nunca llamar al producto "startup", "bot" o "SaaS". Es un **Sistema Integral de Gestión** o **Infraestructura Empresarial**.

## 9 · Lo que NO hay que tocar (estable y funcional)

- `src/lib/rag/` — Búsqueda híbrida funcionando. No refactorizar sin razón.
- `src/lib/file-processor/` — Procesadores de PDF, Excel, DXF, DOCX, imagen. Funcionan.
- `src/lib/ai/agent-tools.ts` y `agent-tools-bound.ts` — 38KB de tools. Muy estable.
- `src/lib/ai/agent-prompt.ts` — System prompt de 198 líneas cuidadosamente calibrado.
- `db/migrations/` — NO modificar migraciones existentes. Solo agregar nuevas.
- `src/components/chat/blocks/` — 4 bloques de UI Generativa completos y funcionando.
