# Plan: Flujo de Empresas y Roles — EdificIA

**Fecha:** 2026-05-14  
**Última auditoría contra código fuente:** 2026-05-14  
**Contexto:** El sistema tiene la base de auth construida. Los 3 bugs críticos de la sesión fueron corregidos. Faltan guards de roles en algunas rutas y el flujo de viewer no está completo.

---

## 1. Bugs de la sesión anterior — Todos corregidos ✅

### BUG-1 — POST /api/projects devuelve error genérico ✅
**Fix verificado:** `POST /api/projects` retorna `code` + `message` real de DB. Código en `src/app/api/projects/route.ts`.

### BUG-2 — Chat devuelve `UNAUTHORIZED` ✅
**Fix verificado:**
- `jwt.ts`: InsForge non-ok → fallback decode-only.
- `client.ts`: `getAuthToken()` verifica exp y llama `auth.refreshSession()` si quedan menos de 2 min.
- `chat/page.tsx`: usa `getAuthToken()` en el transport.

### BUG-3 — Super admin deshabilita empresa pero los usuarios siguen entrando ✅
**Fix verificado:** `requireAuth` línea 51: query a `organizations` verificando `deleted_at IS NULL`. Si la org está deshabilitada retorna 403.

---

## 2. Flujo correcto de uso (lo que tiene que funcionar)

```
SUPER ADMIN (Edificia)
    │
    ▼
Crea invitación de fundador
  ─ email de la empresa
  ─ nombre de la empresa
  ─ (genera invite_token)
    │
    ▼ email con link de registro
FUNDADOR / ADMIN EMPRESA
    │
    ├── Se registra con el link → claim-founder → se crea org + el queda como "admin"
    │
    ├── Puede hacer:
    │   ├── Crear/editar/borrar OBRAS (proyectos) de su empresa
    │   ├── Subir y gestionar documentos (base documental de solo su empresa)
    │   └── Invitar miembros con 2 roles posibles:
    │       ├── "admin"    → mismos permisos que él (puede a su vez invitar)
    │       └── "viewer"   → solo puede chatear con el agente, NO puede borrar/modificar docs
    │
    └── NO puede ver datos de otras empresas (multi-tenant hard)

VIEWER
    │
    ├── Recibe invitación por email
    ├── Se registra con el link
    └── Puede:
        ├── Abrir sesiones de chat con el agente
        ├── Hacer preguntas sobre documentos de la obra activa
        └── NO puede: subir docs, borrar docs, crear/borrar obras, invitar gente
```

---

## 3. Estado actual de cada pieza (VERIFICADO contra código)

| Pieza | Estado | Evidencia |
|---|---|---|
| Super admin — invitar fundador | ✅ funciona | `POST /api/super-admin/founders` crea token + guarda en DB |
| Fundador — claim-founder (registro) | ✅ ruta existe | `POST /api/auth/claim-founder` |
| Admin — invitar miembros | ✅ funciona | `POST /api/admin/members` crea invitación + email vía Resend |
| Viewer — aceptar invitación + registrarse | 🔶 verificar | `POST /api/auth/register` debería hacer claim de `organization_invitation` si existe. Verificar que funciona end-to-end |
| requireAuth — bloquear org deshabilitada | ✅ verificado | Línea 51 de `require-auth.ts` |
| POST /api/projects — error genérico | ✅ fix verificado | Retorna error real de DB |
| Chat UNAUTHORIZED | ✅ fix verificado | Token refresh automático |
| Upload — enforcement viewer | ✅ **YA IMPLEMENTADO** | `upload/route.ts` línea 47: `if (role === "viewer")` → 403 |
| PATCH /api/projects/[id] — enforcement viewer | ✅ **YA IMPLEMENTADO** | Línea 62: `if (auth.role === "viewer")` → apiForbidden |
| DELETE /api/documents (query param) — enforcement viewer | ✅ **YA IMPLEMENTADO** | Exige `role !== "admin"` (nota: solo admin puede borrar por esta ruta) |
| POST /api/projects — enforcement viewer | 🐛 **FALTA** | Sin guard. Viewer puede crear obras |
| DELETE /api/documents/[id] — enforcement viewer | 🐛 **FALTA** | Sin guard. Viewer puede borrar archivos por ruta dinámica |
| GET/POST/PATCH/DELETE /api/admin/* | ✅ funciona | Todas usan `requireAuth(req, { role: "admin" })` |
| Chat UI — botón adjuntar bloqueado para viewer | ✅ funciona | `canUpload = role !== "viewer"` en `chat/page.tsx` |
| Sidebar — link admin oculto para no-admins | ✅ funciona | `AdminNavLink` verifica `role === "admin"` |

---

## 4. Rol `viewer` — qué falta bloquear

El rol existe en el schema (`organization_members.role = 'viewer'`) y ALGUNAS rutas ya lo bloquean, pero faltan 2:

| Ruta | Viewer bloqueado? | TAREA |
|---|---|---|
| `POST /api/upload` | ✅ Ya hecho | — |
| `PATCH /api/projects/[id]` | ✅ Ya hecho | — |
| `DELETE /api/documents` (query param) | ✅ Ya hecho (solo admin) | — |
| `POST /api/projects` | 🐛 **FALTA** | Agregar `if (auth.role === "viewer") return apiForbidden("Los visualizadores no pueden crear obras.")` después del `requireAuth` |
| `DELETE /api/documents/[id]` | 🐛 **FALTA** | Agregar guard similar. Decidir: ¿solo admin puede borrar, o admin + engineer? |
| `POST /api/admin/members` | ✅ Ya hecho | Usa `requireAuth(req, { role: "admin" })` |
| `PATCH /api/admin/members` | ✅ Ya hecho | Usa `requireAuth(req, { role: "admin" })` |

### Nota sobre `requireAuth` y jerarquía de roles

`requireAuth(req, { role: "admin" })` hace comparación `===`, lo que significa que rechaza engineers. Esto hace que engineers NO pueden:
- Ver la lista de miembros
- Invitar gente
- Cambiar configuración de la empresa

Esto puede ser intencional pero debería documentarse. Si se quiere una jerarquía (admin > engineer > viewer), habría que agregar un helper `isAtLeast(role, minRole)`.

---

## 5. Flujo de registro por invitación (viewer / engineer)

Hay dos tipos de invitación:
- **org_founder_invitations** → para el primer admin de una empresa (usa claim-founder)
- **organization_invitations** → para miembros adicionales (admin/engineer/viewer)

**TAREA**: Verificar end-to-end que `POST /api/auth/register` busca una `organization_invitation` pendiente por email y, si existe, crea automáticamente la membresía en la org. Si no lo hace, implementar el claim.

---

## 6. Orden de ejecución sugerido

### Fase 1 — Desbloquear la demo (bugs críticos) ✅ Completada 2026-05-14
1. ✅ **BUG-2** — Fix UNAUTHORIZED en chat.
2. ✅ **BUG-1** — Logging real en POST /api/projects.
3. ✅ **BUG-3** — requireAuth verifica org activa.

### Fase 2 — Guards de roles faltantes
4. 🐛 **Agregar guard viewer en `POST /api/projects`** — 1 línea.
5. 🐛 **Agregar guard viewer en `DELETE /api/documents/[id]`** — 1 línea.
6. Verificar que el flujo de registro con `organization_invitation` funciona end-to-end.

### Fase 3 — Completar flujo de onboarding
7. Probar end-to-end: super admin invita fundador → fundador se registra → queda como admin → puede crear obra.
8. Probar: admin invita viewer → viewer se registra → viewer puede chatear pero no borrar.

### Fase 4 — UX de roles en el dashboard
9. ❌ El sidebar del viewer debe ocultar los botones de "Subir documento" y "Crear obra" (ya oculta Admin).
10. ❌ Las rutas `/dashboard/admin` redirigen si el rol no es admin (ya hecho en el componente con `useEffect`).

---

## 7. Lo que NO hay que tocar en esta fase
- La UI de los bloques de respuesta (ya está completa ✅).
- El sistema de RAG / búsqueda semántica (funciona ✅).
- El procesamiento de archivos (funciona ✅).
- El agente y sus tools (funciona ✅).

---

## 8. Criterio de "listo para demo real"

- [ ] Un fundador nuevo puede registrarse desde una invitación de super admin y llegar al dashboard limpio.
- [ ] Ese fundador puede crear una obra sin error.
- [ ] El fundador puede subir un PDF y hacerle una pregunta al agente sin UNAUTHORIZED.
- [ ] El fundador puede invitar un viewer por email.
- [ ] El viewer puede chatear pero no ve los botones de edición.
- [ ] El viewer NO puede crear obras ni borrar archivos (verificar en backend, no solo UI).
- [ ] Si super admin deshabilita la empresa, el próximo request de cualquier usuario de esa empresa devuelve 403.
