# Plan de Corrección: Login Frontend ↔ Backend

> **Fecha**: 2026-05-14  
> **Objetivo**: Dejar el sistema de autenticación robusto y coherente para producción.  
> **Referencia**: Auditoría completa de los archivos del flujo auth.

---

## Diagnóstico: Problemas Detectados

Después de revisar todo el flujo de autenticación encontré **9 problemas** de distinta severidad. Los ordené de más crítico a menos crítico.

### 🔴 Críticos (pueden causar fallos en producción)

| # | Problema | Archivos involucrados |
|---|----------|-----------------------|
| P1 | **Login hace `signInWithPassword` directo desde el browser al SDK de InsForge** — el token se obtiene del lado del cliente y se persiste manualmente. Si InsForge aplica CORS restrictivo en producción, esto fallará. Además, expone la lógica de auth al frontend. | `login/page.tsx`, `client.ts` |
| P2 | **Register hace lo mismo post-registro** — después de crear la cuenta vía API, el auto-login se hace directo al SDK desde el browser. | `register/page.tsx` |
| P3 | **Cookie `edificia_session` no es `httpOnly`** — se setea con `document.cookie` desde el frontend, por lo que cualquier XSS puede leerla. El token JWT crudo queda expuesto a JavaScript. | `client.ts` línea 36 |
| P4 | **No existe ruta `POST /api/auth/login`** — todo el login pasa por el SDK del cliente. No hay endpoint de backend para login, a pesar de que el registro sí pasa por `/api/auth/register`. Inconsistencia arquitectónica. | Falta crear: `src/app/api/auth/login/route.ts` |

### 🟡 Importantes (funcionan pero con riesgo)

| # | Problema | Archivos involucrados |
|---|----------|-----------------------|
| P5 | **Inconsistencia de contraseña: Login acepta 6 chars, Register exige 10 + mayúscula + número** — un usuario creado antes del cambio de política podría loguearse, pero si cambia contraseña necesita 10. El login en frontend valida con `loginSchema` (min 6), pero InsForge puede tener su propia política. | `validators/index.ts` |
| P6 | **Logout no limpia las cookies del SDK de InsForge del lado del servidor correctamente** — el `POST /api/auth/logout` borra cookies `sb-*` y `insforge_csrf_token`, pero el login nunca setea esas cookies (se usa `document.cookie` para `edificia_session`). El logout del server-side es parcialmente inefectivo. | `logout/route.ts` |
| P7 | **Login no tiene rate limiting** — la ruta `/api/auth/login` no existe, y el login se hace directamente al SDK de InsForge desde el cliente, por lo que no pasa por el rate limiter de la app. Ataque de fuerza bruta viable. | N/A (se resuelve al crear P4) |

### 🟢 Mejoras (calidad y mantenibilidad)

| # | Problema | Archivos involucrados |
|---|----------|-----------------------|
| P8 | **`useCurrentUser.ts` nunca se usa** — existe un hook que llama a `client.auth.getCurrentUser()` pero ningún componente lo importa. Se usa `useOrgMember` en su lugar. Código muerto. | `useCurrentUser.ts` |
| P9 | **No hay refresh automático proactivo del token** — `getAuthToken()` en `client.ts` hace refresh si el token está cerca de expirar, pero solo se llama en el chat. El resto de hooks (`useOrgMember`, `useOrgs`) usan `getHeaders().Authorization` directo que podría estar expirado. | `useOrgMember.ts`, `useOrgs.ts` |

---

## Plan de Ejecución

### Fase 1 — Server-Side Login (resuelve P1, P4, P7)

**Meta**: Mover la autenticación a una API Route del servidor, igual que ya se hace con register.

#### Tarea 1.1: Crear `POST /api/auth/login`

Archivo: `src/app/api/auth/login/route.ts`

```
Lógica:
1. Parsear body con loginSchema (validación Zod)
2. Rate limit con checkRateLimit(key, "auth")
3. Llamar a InsForge admin auth.signInWithPassword desde el servidor
4. Si éxito → generar respuesta con { accessToken, refreshToken }
5. Setear cookie edificia_session como httpOnly, Secure, SameSite=Lax
6. Retornar { ok: true, accessToken, refreshToken }
```

#### Tarea 1.2: Refactorizar `login/page.tsx`

```
Cambiar de:
  - getInsForgeClient().auth.signInWithPassword() directo al SDK
  - Extraer token del header del cliente

A:
  - fetch("/api/auth/login", { method: "POST", body })
  - Recibir tokens del response
  - Guardar en localStorage + setear en el SDK client
  - La cookie httpOnly la setea el servidor
```

#### Tarea 1.3: Refactorizar `register/page.tsx` (auto-login post-registro)

```
Después del POST /api/auth/register exitoso:
  - En vez de signInWithPassword directo al SDK
  - Llamar a POST /api/auth/login con las mismas credenciales
```

---

### Fase 2 — Cookie Segura (resuelve P3, P6)

**Meta**: La cookie de sesión debe ser httpOnly para que no sea accesible desde JS.

#### Tarea 2.1: Setear cookie httpOnly desde el servidor

Archivo: `src/app/api/auth/login/route.ts` (nuevo)

```
Al setear la cookie:
  cookies().set("edificia_session", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 días
  });
```

#### Tarea 2.2: Eliminar `document.cookie` del cliente

Archivo: `src/lib/insforge/client.ts`

```
- Eliminar la línea de document.cookie en persistAuthToken()
- La cookie ahora la maneja el servidor exclusivamente
- persistAuthToken() solo maneja localStorage (para el SDK del cliente)
```

#### Tarea 2.3: Mejorar logout del servidor

Archivo: `src/app/api/auth/logout/route.ts`

```
Asegurar que:
1. Se borra edificia_session con httpOnly (cookieStore.delete)
2. Se limpian todas las cookies relevantes
3. La respuesta confirma el logout
```

---

### Fase 3 — Consistencia y Limpieza (resuelve P5, P8, P9)

#### Tarea 3.1: Unificar política de contraseña

Archivo: `src/lib/validators/index.ts`

```
Opción recomendada: 
- loginSchema.password → mantener min(6) para no bloquear usuarios legacy
- Agregar comentario explícito sobre por qué difieren
- En el frontend de login, NO validar complejidad (eso es solo para registro)
```

> NOTA: La diferencia es intencional: login no debe rechazar contraseñas viejas creadas
> con otra política. Documentar claramente.

#### Tarea 3.2: Eliminar `useCurrentUser.ts`

```
- Borrar src/hooks/useCurrentUser.ts (no se usa en ningún lado)
- Toda la info del usuario se obtiene via useOrgMember
```

#### Tarea 3.3: Usar `getAuthToken()` en todos los hooks

Archivos: `useOrgMember.ts`, `useOrgs.ts`

```
Cambiar:
  const h = getInsForgeClient().getHttpClient().getHeaders();
  if (!h.Authorization) return ...;
  headers: { Authorization: h.Authorization as string }

A:
  const token = await getAuthToken();
  if (!token) return ...;
  headers: { Authorization: `Bearer ${token}` }

Esto asegura que el token se refresque automáticamente si está expirado.
```

---

### Fase 4 — Preparación para Deploy (extras)

#### Tarea 4.1: Agregar `NEXT_PUBLIC_APP_URL` al Dockerfile/deploy

```
Verificar que .env.docker.example incluya NEXT_PUBLIC_APP_URL
(necesario para los emails de reset password y las invitaciones)
→ Ya está incluido ✅
```

#### Tarea 4.2: Validar CORS en producción

```
En next.config.ts:
- ALLOWED_ORIGINS debe ser la URL real del dominio de producción
- Verificar que .env.docker.example tenga ALLOWED_ORIGINS
→ Ya está incluido ✅
```

#### Tarea 4.3: Testear flujo completo en modo build

```
Ejecutar:
1. npm run build (verificar que compila sin errores TypeScript)
2. npm run start (verificar que funciona el standalone)
3. Probar: login → dashboard → logout → login de nuevo
4. Probar: register con invitación → auto-login → dashboard
5. Probar: forgot-password → email → reset-password → login
```

---

## Orden de Ejecución Recomendado

```
Fase 1 (ROJO - Crítico) → Fase 2 (NARANJA - Seguridad) → Fase 3 (VERDE - Limpieza) → Fase 4 (AZUL - Deploy)
```

> **IMPORTANTE**: Las Fases 1 y 2 son las que realmente corrigen la desconexión frontend↔backend.
> Sin ellas, el login depende de que el SDK del browser pueda hablar directamente con InsForge
> (problemas de CORS, seguridad) en vez de pasar por tu propio servidor.

---

## Resumen de Archivos a Modificar/Crear

| Archivo | Acción |
|---------|--------|
| `src/app/api/auth/login/route.ts` | **CREAR** — endpoint server-side login |
| `src/app/(auth)/login/page.tsx` | Modificar — usar `/api/auth/login` |
| `src/app/(auth)/register/page.tsx` | Modificar — auto-login via API |
| `src/lib/insforge/client.ts` | Modificar — quitar `document.cookie` |
| `src/app/api/auth/logout/route.ts` | Modificar — cookie httpOnly |
| `src/hooks/useOrgMember.ts` | Modificar — usar `getAuthToken()` |
| `src/hooks/useOrgs.ts` | Modificar — usar `getAuthToken()` |
| `src/hooks/useCurrentUser.ts` | **BORRAR** — código muerto |
| `src/lib/validators/index.ts` | Documentar — diferencia intencional |
