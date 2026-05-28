# Auditoría EdificIA — 2026-05-28 (Opus 4.8)

> Revisión del estado dejado por Opus 4.7 + Codex. Objetivo: registrar qué está mal y qué se puede mejorar.
> No se cambió código productivo en esta pasada; es diagnóstico.
>
> Severidad: 🔴 alto · 🟡 medio · 🟢 bajo / deuda

## Estado base (lo que sí está bien)

- `npm run type-check` OK, `npm run lint` OK, `npm test` 85/85 OK.
- Código limpio en lo formal: 1 `any` (justificado, en comentario), 0 `console.log`, 6 `TODO`/`FIXME`.
- Multi-tenancy correcto en lo revisado: las rutas filtran por `auth.orgId`, las nuevas rutas de fuentes (`/api/enterprise-context/sources`) usan `requireAuth` + role gating + Zod + rate-limit + `captureAppError`. Patrón consistente.
- Las rutas API sin `requireAuth` son todas esperadas (`health`, `seed-demo`, `auth/*`).

El proyecto no tiene un problema de *calidad formal*. Los problemas reales son de **robustez de borde, deuda documental y riesgo de producto**.

---

## 1 · Seguridad / robustez

### 🔴 1.1 — JWT sin verificación de firma local
`src/lib/auth/jwt.ts`: `verifyUserId()` decodifica el payload (base64, sin verificar firma) y delega 100% la validación a un round-trip a `INSFORGE_URL/auth/v1/user`. Si InsForge no responde y `AUTH_STRICT_MODE` no es estricto (dev por defecto), se confía en el decode sin firma. En producción strict mode rechaza — bien — pero no hay defensa criptográfica propia (no se valida la firma JWT contra una clave pública/secret). Toda la seguridad de sesión cuelga de un servicio externo disponible.
- **Mejora:** verificar la firma localmente con la clave de InsForge (jose/jwks) además del cache; degradar a round-trip solo como confirmación de revocación.

### 🟡 1.2 — Cache de verificación keyed por últimos 20 chars del token
`_verifyCache` usa `token.slice(-20)` como clave. Colisión teórica improbable, pero conceptualmente débil: dos tokens distintos con el mismo sufijo compartirían veredicto cacheado. **Mejora:** hashear el token completo (sha256) como clave.

### 🔴 1.3 — Race conditions en alta de organización (check-then-insert)
`src/app/api/auth/claim-founder/route.ts` (y el equivalente `claim-invitation`): el flujo es *leer membresía existente → insertar org → insertar member → marcar invitación aceptada*, sin transacción ni unique constraint que garantice atomicidad. Dos requests concurrentes del mismo usuario pueden crear orgs/membresías duplicadas. Ya estaba marcado en la memoria de seguridad (race conditions). **Mejora:** unique index `(user_id)` parcial donde aplique + upsert idempotente, o envolver en transacción server-side.

### 🟡 1.4 — Sin validación central de variables de entorno (fail-fast)
No existe módulo de validación de env al arranque. Cada lib lee `process.env.X ?? ""` (12 archivos en `src/lib`). Una env faltante o mal escrita no falla al boot: se manifiesta como auth roto / fetch a URL vacía en runtime. **Mejora:** un `src/lib/env.ts` con Zod que valide al import y dé error claro.

### 🟡 1.5 — RLS founder_invitations pendiente (de memoria de seguridad)
Verificar que `org_founder_invitations` y tablas sensibles tengan RLS por `organization_id` como última línea de defensa, no solo el filtrado app-side. El filtrado en app es correcto pero no sustituye a RLS si el admin client se usa sin scope.

---

## 2 · Deuda documental / drift (lo más visible del trabajo de 4.7)

### 🟡 2.1 — Mucho trabajo sin commitear = "estado real" ≠ último commit
Hay ~40 archivos modificados y ~25 untracked nuevos (bloques UI, `src/app/api/enterprise-context/sources/`, `src/lib/rag/structure.ts`, `src/lib/enterprise-context/*`, primitives `ui/*`). El `ROADMAP.md` y el `AI_WORKLOG` marcan como ✅ cosas que **solo viven en el working tree** (ej. "Indexación estructural ✅ 2026-05-20", "Shadcn CLI + bloques ✅"). Riesgo de pérdida y de auditoría confusa. **Mejora:** commitear el trabajo terminado; no marcar ✅ en ROADMAP lo que no está en git.

### 🟢 2.2 — Comentarios "Claude multimodal" describen modelo viejo
`src/lib/file-processor/{dxf-processor,pdf-processor,types}.ts` mencionan "Claude" como modelo, pero el runtime real es DeepSeek. Ya anotado como pendiente en el worklog del 2026-05-20, sin resolver. **Mejora:** reemplazar por "modelo multimodal".

### 🟢 2.3 — ROADMAP convertido en historial
`ROADMAP.md` tiene ~170 líneas casi todas ✅. La §4 dice "no repetimos completados", pero §1–2 están llenas de completados con descripciones largas. El roadmap dejó de ser un roadmap (qué falta) y es una bitácora. **Mejora:** mover completados a un CHANGELOG y dejar el ROADMAP con lo pendiente real (que hoy es básicamente §0 Pendientes externos).

---

## 3 · Calidad de código / mantenibilidad

### 🟡 3.1 — Suppressions de react-hooks/exhaustive-deps
`src/app/dashboard/chat/page.tsx` (líneas 131, 138) y `register/page.tsx` (48) silencian `exhaustive-deps`. Es el patrón clásico que esconde stale-closures. Los `set-state-in-effect` disabled son más benignos pero también vale revisarlos. **Mejora:** auditar cada uno; los de `chat/page` son sensibles (manejan sessionId/status del stream).

### 🟡 3.2 — `agent-tools.ts` monolítico (~38KB) marcado "no tocar"
CLAUDE.md §9 lo declara estable e intocable. Razonable para no romper, pero es un monolito difícil de testear unitariamente. La cobertura de tests no lo toca. **Mejora futura (con cuidado):** extraer tools a módulos por dominio detrás del mismo registry, para poder testear cada una.

### 🟡 3.3 — Cobertura de tests acotada a lógica pura
85 tests, 3 suites: math-engine, excel parser, schedule importer, structure, enterprise profile aggregator. **No hay tests de rutas API, `requireAuth`, multi-tenancy ni runtime del agente** — justo las zonas con los riesgos 🔴 de arriba. **Mejora:** tests de integración de auth/tenancy (al menos que una org no vea datos de otra).

---

## 4 · Producto / arquitectura

### 🟡 4.1 — Mucha superficie construida en paralelo, poca activada
En ~2 semanas se levantaron en paralelo: Agent Core, Enterprise Context (slices 1-2 + sources), Knowledge Graph, Work Cases, Proactividad, Document Intelligence Reports, Memoria activa, Router de modelos, 6 bloques UI. Varias features están ✅ pero en estado **"audit-only"** (no cambian comportamiento) o **"pendiente externo"** (no entregan valor todavía). Riesgo de sobre-ingeniería antes de tracción. **Mejora:** priorizar terminar una vertical end-to-end con valor de usuario antes de sumar capas.

### 🔴 4.2 — El núcleo de "Inteligencia Empresarial" sigue siendo fachada
La propuesta central (conectarse read-only a fuentes reales: Drive/SharePoint/SQL/ERP) **no existe**: solo hay registro de fuentes y carga manual (`manual_upload`). Todo el valor real depende de conectores que están en §0 "pendientes externos". El producto, hoy, sigue siendo un repositorio de archivos subidos — exactamente lo que CLAUDE.md §7.1 dice que NO debe ser. **Mejora:** definir si se hace un conector real (aunque sea uno, ej. Drive OAuth) o se recorta la narrativa de "inteligencia empresarial".

### 🟡 4.3 — Motor de proactividad nunca se ejecuta
El daily scan + read model están ✅ pero el schedule nunca se activa (falta URL pública / `CRON_SECRET`). Una feature core construida y dormida. **Mejora:** decidir si se despliega a una URL estable o se baja de prioridad explícitamente.

---

## Resumen accionable (orden sugerido)

1. 🔴 Commitear el trabajo terminado del working tree (2.1) — antes de cualquier otra cosa, para no perderlo.
2. 🔴 Cerrar race conditions de alta de org con constraint/transacción (1.3).
3. 🔴 Verificación de firma JWT local (1.1).
4. 🟡 Validación central de env con Zod fail-fast (1.4).
5. 🟡 Tests de integración auth + multi-tenancy (3.3).
6. 🟡 Decisión de producto: conector real vs. recortar narrativa (4.2) y schedule (4.3).
7. 🟢 Limpiar drift documental: comentarios "Claude" (2.2), ROADMAP→CHANGELOG (2.3).
