# Plan: Flujo de Empresas y Roles — EdificIA

**Fecha:** 2026-05-14  
**Contexto:** El sistema tiene la base de auth construida pero hay bugs activos y el flujo completo de onboarding de empresas nunca se probó end-to-end. Este documento define qué hay que arreglar, qué falta construir, y el orden de ejecución.

---

## 1. Bugs activos (bloquean la demo)

### BUG-1 — POST /api/projects devuelve error genérico ✅ Logging mejorado (2026-05-14)

**Fix:** `POST /api/projects` ahora retorna el `code` y `message` real de la DB en vez de "Internal error". El esquema está correcto — si sigue fallando, el error real aparece en el response JSON.

---

### BUG-2 — Chat devuelve `UNAUTHORIZED` ✅ Corregido (2026-05-14)

**Fix:**
- `jwt.ts`: InsForge non-ok → cae al fallback decode-only (antes solo hacía fallback en errores de red).
- `client.ts`: `getAuthToken()` verifica exp localmente y llama `auth.refreshSession()` si quedan menos de 2 min. Persiste refresh token en `localStorage`.
- `chat/page.tsx`: usa `getAuthToken()` en el transport.
- `login/page.tsx` + `register/page.tsx`: persisten `refreshToken` de la respuesta.

---

### BUG-3 — Super admin deshabilita empresa pero los usuarios siguen entrando ✅ Corregido (2026-05-14)

**Fix:** `requireAuth` hace un segundo query a `organizations` verificando `deleted_at IS NULL`. Si la org está deshabilitada retorna 403 "La organización está deshabilitada.".

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

## 3. Estado actual de cada pieza

| Pieza | Estado | Gap |
|---|---|---|
| Super admin — invitar fundador | ✅ funciona | — |
| Fundador — claim-founder (registro) | ✅ ruta existe | No probado end-to-end |
| Admin — invitar miembros (`admin`/`engineer`/`viewer`) | ✅ ruta existe | `viewer` no tiene restricciones reales en el backend |
| Viewer — aceptar invitación + registrarse | ❓ | Ruta `claim-invitation` existe? Verificar |
| requireAuth — bloquear org deshabilitada | ✅ fix aplicado | Ver BUG-3 |
| POST /api/projects | ✅ logging mejorado | Ver BUG-1 |
| Chat UNAUTHORIZED | ✅ fix aplicado | Ver BUG-2 |
| Docs API — enforcement del rol viewer (no puede borrar) | ❌ falta | `DELETE /api/documents/[id]` no verifica viewer |
| Upload API — enforcement del rol viewer (no puede subir) | ❌ falta | `POST /api/upload` no verifica viewer |

---

## 4. Rol `viewer` — qué tiene que bloquear

El rol existe en el schema (`organization_members.role = 'viewer'`) pero no tiene restricciones reales en las rutas. Hay que agregar guards en:

| Ruta | Acción bloqueada para viewer |
|---|---|
| `POST /api/upload` | Subir documentos |
| `DELETE /api/documents/[id]` | Borrar documento |
| `POST /api/projects` | Crear obra |
| `DELETE /api/projects/[id]` | Borrar obra |
| `POST /api/admin/members` | Invitar miembros |
| `PATCH /api/admin/members` | Cambiar roles |

El chat (`POST /api/chat`) y la lectura de documentos (`GET /api/documents`) sí deben estar disponibles para viewer.

El pattern es simple: en `requireAuth` se puede pasar `{ role: "admin" | "engineer" }` pero no hay un "no debe ser viewer". Se puede agregar `opts.minRole` o simplemente una helper `requireNotViewer(auth)`.

---

## 5. Flujo de registro por invitación (viewer / engineer)

Hay dos tipos de invitación:
- **org_founder_invitations** → para el primer admin de una empresa (usa claim-founder)
- **organization_invitations** → para miembros adicionales (admin/engineer/viewer)

La ruta `POST /api/auth/register` necesita verificar si el email tiene una `organization_invitation` pendiente y, si existe, ejecutar el claim automáticamente (crear membresía en la org). Esto puede estar roto o incompleto — verificar antes de implementar el flujo de viewer.

---

## 6. Orden de ejecución sugerido

### Fase 1 — Desbloquear la demo (bugs críticos) ✅ Completada 2026-05-14
1. ✅ **BUG-2** — Fix UNAUTHORIZED en chat.
2. ✅ **BUG-1** — Logging real en POST /api/projects.
3. ✅ **BUG-3** — requireAuth verifica org activa.

### Fase 2 — Completar flujo de onboarding
4. Probar end-to-end: super admin invita fundador → fundador se registra → queda como admin → puede crear obra.
5. Verificar que `POST /api/auth/register` hace claim de invitation si existe.
6. Probar: admin invita viewer → viewer se registra → viewer puede chatear pero no borrar.

### Fase 3 — Enforcement de roles
7. Agregar guard "no viewer" en las rutas de escritura listadas en §4.
8. Agregar check `organizations.deleted_at` en `requireAuth`.

### Fase 4 — UX de roles en el dashboard
9. El sidebar del viewer debe ocultar los botones de "Subir documento", "Crear obra", "Administración".
10. Las rutas `/dashboard/admin` deben redirigir si el rol es viewer.

---

## 7. Lo que NO hay que tocar en esta fase
- La UI de los bloques de respuesta (ya está completa).
- El sistema de RAG / búsqueda semántica (funciona).
- El procesamiento de archivos (funciona).
- El agente y sus tools (funciona excepto el bug del token).

---

## 8. Criterio de "listo para demo real"

- [ ] Un fundador nuevo puede registrarse desde una invitación de super admin y llegar al dashboard limpio.
- [ ] Ese fundador puede crear una obra sin error.
- [ ] El fundador puede subir un PDF y hacerle una pregunta al agente sin UNAUTHORIZED.
- [ ] El fundador puede invitar un viewer por email.
- [ ] El viewer puede chatear pero no ve los botones de edición.
- [ ] Si super admin deshabilita la empresa, el próximo request de cualquier usuario de esa empresa devuelve 403.
