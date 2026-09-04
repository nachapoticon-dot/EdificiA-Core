# EdificIA — Explicación técnica del proyecto

> Mapa técnico del sistema: qué stack usa, cómo se conectan frontend, backend, agente y base de datos, y dónde vive cada pieza en el código. Para estado y pendientes ver `00_PRODUCTO.md`.

---

## 1. Qué es

EdificIA es un sistema de operaciones para constructoras con un agente de IA que actúa como **Project Manager Digital**. Multi-tenant estricto. El modelo de dominio es:

```text
Empresa (organizations)
  → Obra (projects)
    → Expediente Operativo (work_cases)
      → Eventos (work_case_events) / Evidencias (work_case_evidence) / Ejecuciones (agent_runs)
```

El chat es una interfaz, no el centro: el agente lee documentos, audita presupuestos, consulta el estado operativo de la obra (cronograma, HSE, acopios, finanzas, clima) y deja cada conclusión trazada a evidencia.

Desde 2026-06-11 corre **100% sobre infraestructura propia**. Únicos servicios externos: DeepSeek (LLM) y NVIDIA NIM (embeddings).

## 2. Stack

| Capa | Tecnología | Dónde |
|------|-----------|-------|
| Framework | Next.js 16 (App Router, Turbopack) + TypeScript strict | `src/app/` |
| UI | Shadcn + Tailwind v4 + Framer Motion + lucide | `src/components/` |
| Data fetching cliente | TanStack Query v5 | `src/hooks/` |
| Validación | Zod v3 (requests, responses y bloques del agente) | `src/lib/validators/` |
| LLM | DeepSeek vía `@ai-sdk/openai-compatible` (AI SDK v6) | `src/app/api/chat/route.ts` |
| Agente alternativo | Python FastAPI (flag `AGENT_BACKEND=python`) | `services/agent/` |
| Embeddings | NVIDIA NIM `baai/bge-m3` (1024 dims) | `src/lib/embeddings/` |
| DB | PostgreSQL 16 + pgvector, aislamiento multi-tenant app-level (RLS definido pero bypasseado: el backend conecta como owner) | `migrations/` + `docker-compose.yml` |
| Capa de datos | Query-builder propio sobre `pg` | `src/lib/db/` |
| Auth | Propia: bcryptjs + JWT HS256 (jose) + refresh tokens con rotación | `src/lib/auth/` |
| Storage | Filesystem local (`STORAGE_DIR`) con interfaz de adapter | `src/lib/storage/fs-adapter.ts` |
| Parsers de archivos | xlsx · pdf-parse · mammoth (DOCX) · dxf-parser · imágenes | `src/lib/file-processor/` |
| Generadores | jsPDF + autotable · docx · xlsx | `src/lib/export/` |
| Email | Resend | `src/lib/email/resend.ts` |
| Logs | Pino estructurado | `src/lib/logger.ts` |

## 3. Cómo se conecta el frontend con el backend

El flujo de un request típico del dashboard:

```text
Componente cliente ("use client")
  → hook TanStack Query (src/hooks/useXxx.ts)
    → fetch("/api/...", { headers: Authorization: Bearer <JWT> })   ← getAuthHeaders() (src/lib/insforge/client.ts)
      → Route Handler (src/app/api/.../route.ts, runtime nodejs)
        → requireAuth(req) → { userId, orgId, role }
        → query-builder: client.database.from("tabla").select(...).eq("organization_id", auth.orgId)
        → Zod .parse() del response (src/lib/validators/api-responses.ts)
      ← JSON tipado
    ← el hook valida/normaliza y cachea por queryKey
```

Detalles que importan:

- **El frontend nunca toca la DB.** Todo pasa por API routes. No hay server actions ni SDK de DB en el browser.
- **Sesión en el cliente**: el access token (JWT HS256, corto) vive en `localStorage`; `getAuthHeaders()` lo renueva automáticamente con `POST /api/auth/refresh` usando un refresh token opaco que rota server-side (`auth.refresh_tokens`, hasheado).
- **Protección de navegación**: `src/proxy.ts` (middleware) protege `/dashboard/*` leyendo la cookie `edificia_session` y **verificando la firma HS256 localmente** con jose (`AUTH_JWT_SECRET`). Sin sesión → redirect a `/login`. También responde CORS para `/api/*`.
- **Contratos compartidos**: los schemas Zod de `api-responses.ts` se usan en el route handler (parse antes de responder) y en los hooks (safeParse al recibir). Si el shape cambia, rompe en build/test, no en producción.

## 4. Capa de datos (`src/lib/db/`)

Reemplazo propio del SDK de InsForge, manteniendo su interfaz para no tocar ~100 call sites:

- `pool.ts` — Pool `pg` singleton (sobrevive hot-reload vía `globalThis`). Type parsers de compatibilidad PostgREST: timestamps → string ISO, `INT8`/`NUMERIC` → `Number`.
- `query-builder.ts` — `.from().select().eq().is().order().single()/.maybeSingle()` → siempre devuelve `{ data, error, count }`, **nunca lanza**. Compila a SQL parametrizado; identificadores validados (anti-inyección). Esa semántica está fijada en `tests/db/`.
- `sql.ts` — escape hatch para SQL raw (pgvector, agregaciones, FTS).
- `admin-client.ts` — shim `{ database, storage, auth }`. `src/lib/insforge/server.ts` es un re-export histórico de esto (el nombre quedó para no romper imports).

Migraciones: `migrations/*.sql` con runner propio (`npm run migrate`, `npm run migrate:new`). Las tablas de tenant tienen policies RLS por `organization_id` escritas en las migraciones, **pero hoy no aplican**: el pool conecta como owner de las tablas (que bypassea RLS) y no se setea ningún contexto por transacción (`bootstrap-local.sql` lo documenta). Quedan como base para activar RLS real (rol no-owner + GUC por transacción), pendiente en `00_PRODUCTO.md`.

**Regla absoluta de multi-tenancy**: toda query (incluida la vectorial) filtra por `organization_id` derivado de `auth.orgId` resuelto server-side. Jamás confiar en IDs del cliente para aislar tenant. ⚠️ Mientras el RLS no esté activo, este filtro app-level es la **única** línea de defensa de aislamiento entre orgs: un `.eq("organization_id", ...)` olvidado es un cross-tenant leak directo.

## 5. Auth de punta a punta

1. **Registro/login** (`/api/auth/*`): `auth.users` (email citext + hash bcryptjs). Login emite access JWT (HS256, jose) + refresh token opaco.
2. **Middleware** (`src/proxy.ts`): valida cookie para páginas del dashboard.
3. **API**: `requireAuth(req)` (`src/lib/auth/require-auth.ts`) extrae Bearer, verifica firma y expiración localmente (`verifyUserId`), resuelve org membership y rol.
4. **Roles**: `admin` | `engineer` | `viewer`. Admins acceden a `/api/admin/*`; viewers solo chatean.
5. **Rutas sin auth de usuario** (únicas excepciones): `/api/health`, `/api/auth/register`, `/api/seed-demo`, `/api/super-admin/*` (clave propia `SUPER_ADMIN_KEY`) y `/api/internal/*` (gateway del agente Python, `AGENT_GATEWAY_SECRET`, jamás público).

## 6. El agente (chat)

`POST /api/chat` es streaming SSE. Dos backends que consumen el mismo prompt:

**Runtime TS (default)**
1. El cliente (`useChat` del AI SDK + `DefaultChatTransport`) manda los mensajes con headers `x-chat-session-id` / `x-project-id`.
2. `src/lib/agent-core/runtime.ts` resuelve el **scope** server-side: sesión → expediente (`work_case_id`) → obra → empresa, validando todo contra `auth.orgId`.
3. Compone el **prompt modular por capacidades** (`src/lib/ai/prompt/`): identidad PM Digital + solo los módulos relevantes al turno (operaciones / auditoría documental / presupuesto / generación). La auditoría se activa por señal (archivo o pedido), no por defecto.
4. `streamText` contra DeepSeek con **tools bound** (`agent-tools-bound.ts`): cada tool recibe `organization_id`/actor inyectados server-side, nunca del modelo.
5. Al cerrar el turno escribe trazabilidad best-effort: `agent_runs` (modelo, tier, usage, telemetría de tools, latencia), eventos de expediente y `audit_log_events`.

**Cerebro Python (`AGENT_BACKEND=python`)**
- `services/agent/` (FastAPI + uvicorn). `/api/chat` le hace pipe del SSE.
- Obtiene contexto y ejecuta tools **de vuelta contra Next.js** vía el tool gateway `/api/internal/tools/*` (manifest generado con `zod-to-json-schema`, auth por `AGENT_GATEWAY_SECRET`).
- Maneja la **memoria episódica** directo a Postgres con asyncpg: `agent_memories` + `agent_feedback` — reflexión LLM post-turno, retrieval semántico inyectado al prompt, refuerzo/decay por feedback.

**UI generativa**: el agente llama tools `proyectar_*` (métricas, comparativas, cronograma, riesgos, evidencia, legajo gráfico); el resultado se valida con `src/lib/validators/blocks.ts` y `MessageBubble.tsx` renderiza el bloque React correspondiente (`src/components/chat/blocks/`). El texto interpreta el bloque, no lo duplica en Markdown.

## 7. Documentos y RAG

```text
POST /api/upload
  → file-processor (Excel/PDF/DXF/DOCX/imagen → texto + estructura + señales)
  → storage filesystem (fs-adapter, STORAGE_DIR)
  → uploaded_files (metadata + indexing_status)
  → ingest.ts: chunking que preserva estructura (section_path) → embeddings NIM bge-m3 → document_chunks.embedding (pgvector)
  → scans best-effort: PII, contradicciones contra documentos previos (context-scan), reporte documental (document_intelligence_reports)
```

La búsqueda (`src/lib/rag/search.ts`) es **híbrida**: similitud coseno pgvector + full-text search en español + ilike, siempre filtrada por `organization_id` (y `project_id` cuando hay obra activa). El agente la consume como tool.

## 8. Datos operativos y de inteligencia

Grupos de tablas (todas con `organization_id`, soft-delete y policies RLS escritas — ver la salvedad de la sección 4: hoy el aislamiento efectivo es el filtro app-level):

- **Operación de obra**: `project_schedule_tasks`, `project_financial_snapshots` (curva S), `project_subcontracts`, `project_hse_records`, `project_supply_items`. El agente las lee/escribe vía tools auditadas; `buildDailyBrief()` las consolida en el brief diario (+ clima Open-Meteo).
- **Expedientes**: `work_cases` (kind/status/verdict), `work_case_events` (append-only), `work_case_evidence` (vínculos tipados a archivos, chunks, hallazgos, etc.), `agent_runs`.
- **Hallazgos vivos**: `operational_findings` — read model del scanner diario de proactividad (`/api/cron/project-proactivity`); separado de `audit_log_events`, que es evidencia inmutable con hash encadenado.
- **Inteligencia empresarial** (`/dashboard/contexto`: Radar / Fuentes / Mapa Vivo): `enterprise_sources`, `enterprise_documents` (con estados de preparación `descubierta` → `indexada`/`operativa`/`observada`), `enterprise_entities`/`patterns`/`project_coverage`/`profile_snapshots` — el "perfil vivo" de la empresa que también se inyecta al prompt.
- **Memoria del agente**: `agent_memories`, `agent_feedback`, `company_learned_patterns` (legacy en deprecación).

## 9. Operación local

```bash
colima start
docker compose up -d postgres   # PostgreSQL 16 + pgvector
npm run migrate
npm run dev                     # http://localhost:3000
# opcional, cerebro Python:
cd services/agent && .venv/bin/python -m uvicorn app.main:app --port 8000
colima stop                     # apagar todo
```

Env clave: `DATABASE_URL`, `AUTH_JWT_SECRET`, `DEEPSEEK_API_KEY`, `NVIDIA_API_KEY`, `STORAGE_DIR`, `AGENT_BACKEND`, `AGENT_GATEWAY_SECRET`, `SUPER_ADMIN_KEY`, `RESEND_API_KEY`. Ver `.env.local.example`.

Verificación: `npm run type-check` · `npm test` (node:test, incluye contratos de la capa db) · `npm run smoke:chat` (3 turnos reales contra DeepSeek) · evals de conducta del agente en `evals/` y `services/agent/evals/`.

## 10. Principios que explican el diseño

- **El motor de auditoría es dinámico, no rígido**: no impone matemática fija; aprende los patrones de cada empresa (redondeos, rubros, proveedores frecuentes) desde sus propios archivos y los usa como contexto.
- **Las tools son instrumentos, no el razonamiento**: el agente clasifica, forma hipótesis, contrasta con contexto, verifica con tools y sintetiza hechos/riesgos/inferencias. Nunca exponer mecánicas internas ("ejecutando 9 reglas") como producto.
- **Trazabilidad antes que magia**: cada respuesta importante debe poder explicar su evidencia (expediente, reporte documental, audit log).
- **Solo lectura por defecto** hacia fuentes externas futuras; permisos mínimos y revocables.
