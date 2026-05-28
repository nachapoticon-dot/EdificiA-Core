# Próximos pasos — EdificIA

> Creado 2026-05-28 tras la auditoría (`docs/09_auditoria_2026-05.md`).
> Foco: estabilizar lo construido y reducir sobre-ingeniería antes de sumar capas nuevas.
> Esta lista es corta a propósito. Cuando un item se completa, se tacha o se borra.

## Regla de trabajo para esta etapa

**No agregar features ni capas nuevas hasta cerrar la base.** El proyecto ya tiene mucha superficie construida en paralelo (Agent Core, Enterprise Context, Knowledge Graph, Work Cases, Proactividad). El próximo salto NO es más código: es terminar y conectar lo que ya existe, y borrar/recortar lo que no entrega valor.

---

## A · Estabilizar la base (hacer primero)

1. **Commitear el trabajo terminado del working tree.**
   Hay ~40 archivos modificados + ~25 untracked (sources API, `structure.ts`, bloques UI, primitives `ui/*`). El ROADMAP marca ✅ cosas que solo viven sin commitear. Riesgo de pérdida. → Commit limpio por bloque temático.

2. ~~**Cerrar race conditions en alta de organización.**~~ ✅ hecho 2026-05-28.
   `claim-founder` ahora elige un único ganador con compare-and-swap sobre la invitación (pending→accepted condicional) + rollback ante fallo, evitando orgs duplicadas. `claim-invitation` ya estaba cubierto por `UNIQUE(organization_id, user_id)`; se agregó manejo de error idempotente (re-chequeo de membresía ante conflicto). `register` queda protegido por la unicidad de `signUp`.
   Nota / deuda menor: el constraint es `UNIQUE(organization_id, user_id)` completo, no parcial por `deleted_at`; re-invitar a un miembro soft-deleted fallaría. Migrar a índice único parcial queda como follow-up.

3. **Validación central de variables de entorno (fail-fast).**
   Crear `src/lib/env.ts` con Zod que valide al import (DEEPSEEK/INSFORGE/SERVICE_ROLE_KEY/QDRANT). Hoy un env faltante falla recién en runtime.

4. **Verificación de firma JWT local.**
   `src/lib/auth/jwt.ts` delega 100% a InsForge. Agregar verificación de firma (jose/jwks) y usar el round-trip solo para revocación. Cambiar la clave del cache de "últimos 20 chars" a hash del token completo.

## B · Cubrir lo que no tiene tests

5. **Tests de integración auth + multi-tenancy.**
   Hoy los 85 tests son lógica pura. Falta el caso crítico: que una org no pueda ver datos de otra. Al menos un test por: `requireAuth`, una ruta con `orgId`, y RLS.

## C · Decisiones de producto (recortar sobre-ingeniería)

6. **Inteligencia Empresarial: conector real vs. recortar narrativa.**
   Hoy es fachada (solo `manual_upload`). Decidir: o se hace UN conector real (ej. Drive OAuth read-only) end-to-end, o se baja la narrativa de "inteligencia empresarial" a lo que realmente hace. No dejar la fachada a medio camino.

7. **Motor de proactividad: desplegar o congelar.**
   Construido y dormido (sin URL pública / `CRON_SECRET`). Decidir si se despliega a una URL estable o se marca explícitamente como congelado para no mantener código muerto.

8. **Inventario de features "audit-only" / dormidas.**
   Listar qué está construido pero no entrega valor de usuario hoy. Para cada una: activar, simplificar o borrar. El objetivo es que cada capa que se mantiene tenga un usuario real.

## D · Higiene (cuando haya hueco)

9. **ROADMAP → CHANGELOG.** Mover los ✅ a un changelog y dejar el ROADMAP solo con lo pendiente.
10. **Revisar suppressions `exhaustive-deps`** en `chat/page.tsx` (riesgo de stale-closure en el stream).
11. ~~Comentarios "Claude multimodal" obsoletos en file-processor~~ ✅ hecho 2026-05-28.

---

Detalle y severidad de cada punto: `docs/09_auditoria_2026-05.md`.
