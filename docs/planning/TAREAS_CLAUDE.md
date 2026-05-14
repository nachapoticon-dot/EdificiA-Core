# Tareas Pendientes para Claude

> **Última auditoría de estado**: 2026-05-14
> 
> Leyenda: ✅ = Hecho | 🔶 = Parcial | ❌ = Pendiente

Este documento recopila los errores encontrados y las nuevas características o mejoras que deben ser implementadas en el proyecto. 

---

## 🐛 Errores a Corregir

- ✅ **Error al generar Excel** — Corregido (2026-05-14):
  - Guard en `generar_presupuesto_excel`: si `cacheId` expiró → error explícito en lugar de propuesta con 0 ítems.
  - Guard adicional: si no hay `cacheId` ni `items` → error explícito.
  - System prompt actualizado: regla estricta de STOP tras llamar herramientas de generación + instrucción de no llamar `buscar_en_base_documental` antes de generar.

- ✅ **PDF con 0 páginas y OCR falso** — Corregido (2026-05-14):
  - Cuando `pdf-parse` lanza excepción (PDF/A, encoding, seguridad), `pageCount` ya no es 0.
  - `estimatePageCountFromBytes()`: cuenta `/Type /Page` en raw bytes (sin confundir con `/Type /Pages`).
  - `isScanned: true` se mantiene correcto (texto no extraíble = tratar como escaneado).

- ✅ **Auth rota (CRÍTICO)** — Corregido:
  - `src/middleware.ts` real protege `/dashboard/*`, redirige a `/login`
  - `verifyUserId()` verifica JWT contra InsForge server-side (cache 60 s)
  - `requireAuth()` centralizado en `src/lib/auth/require-auth.ts` — 18 routes refactorizadas
  - `/api/chat` y `/api/upload` ahora requieren auth estricta (sin fallbacks)
  - Token en `localStorage` + cookie `edificia_session` (7 días), logout limpia ambos

---

## ✨ Mejoras y Cosas a Agregar

- ✅ **Selector/Card de Organización Dinámico**
  - Componente `OrganizationCard.tsx` creado.
  - Se renderiza en el dashboard layout (`src/app/dashboard/layout.tsx`).
  - Muestra datos de la organización activa del usuario.
  - *Estado*: Componente creado y conectado, datos dinámicos desde `/api/auth/me`.

- ✅ **Tarjeta de Obra Activa**
  - Componente `ActiveProjectSection.tsx` creado.
  - Se renderiza en el dashboard layout debajo de la card de organización.
  - Hook `useProjectDetails.ts` para datos dinámicos.
  - Hook `useProjectCoverage.ts` para cobertura documental.
  - *Estado*: Funcional con datos reales de la obra seleccionada.

- ✅ **Íconos de Acción (Búsqueda y Configuración)**
  - Íconos de Buscar (lupa) y Configuración (engranaje) agregados en el header del sidebar.
  - Link de configuración apunta a `/dashboard/admin/settings`.
  - *Estado*: En el layout, visibles y funcionales.

- ✅ **Rediseño de Tarjetas de Documentos Subidos**
  - Componente `FileCard.tsx` rediseñado con:
    - Ícono del archivo según tipo a la izquierda.
    - Nombre del archivo.
    - Metadatos reales: cantidad de ítems, hoja/sección, monto total.
    - Adaptación a modo claro/oscuro.
  - *Estado*: Funcional con datos extraídos del procesamiento de archivos.

- ✅ **Componentes de UI Generativa (Generative UI Blocks)** — Activados (2026-05-14):
  - Los 4 bloques ya estaban implementados visualmente pero faltaba conectarlos al agente.
  - **Fix**: Las 4 tools (`proyectar_metricas`, `proyectar_comparativa`, `proyectar_cronograma`, `proyectar_legajo_grafico`) agregadas a `createBoundTools()` en `agent-tools-bound.ts`.
  - **Fix**: Las 4 tools agregadas a `SPECIAL_TOOLS` en `MessageBubble.tsx` para suprimir el rendering genérico.
  - `proyectar_legajo_grafico` está bound con `orgId` del servidor (sin `organizationId` en el schema del LLM).
  - *Estado*: Funcional. El agente puede proyectar métricas, ranking, cronograma y legajo gráfico.

- ✅ **Panel SuperAdmin y Seguridad de Datos**
  - Panel completo en `/super-admin` con auth propia (SUPER_ADMIN_KEY).
  - 3 tabs: Fundadores, Empresas, Estadísticas.
  - API routes: `/api/super-admin/founders`, `/api/super-admin/companies`, `/api/super-admin/reset`.
  - Gestión de invitaciones de fundador con tokens.
  - Toggle habilitar/deshabilitar empresas.
  - Selector de estado de suscripción.
  - Stats de storage, miembros, proyectos por empresa.
  - Reset completo (DB + Qdrant) con confirmación.
  - *Estado*: Funcional. ⚠️ El middleware estaba bloqueando el acceso (ya corregido: se sacó `/super-admin` de `proxy.ts`).

---

## 📋 Resumen rápido

| Feature | Estado |
|---------|--------|
| OrganizationCard dinámico | ✅ |
| Tarjeta de Obra Activa | ✅ |
| Íconos Búsqueda/Config | ✅ |
| FileCard con metadatos reales | ✅ |
| Panel SuperAdmin | ✅ |
| UI Generativa (4 bloques) | ✅ |
| Fix error Excel gen | ✅ |
| Fix PDF 0 páginas / isScanned falso | ✅ |
| Fix Auth completo | ✅ |
