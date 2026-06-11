# Plan: Agente especializado real + redocumentación

> Trazado 2026-06-11. **Plan aprobable, NO ejecutado.** Próxima sesión: ejecutar por etapas.
> Restricción operativa del dueño: no levantar todos los servicios a la vez (consumo de máquina).

## Diagnóstico — por qué el agente "siempre se tira a auditar"

El sesgo no está en un solo lugar; está cosido en tres capas:

1. **El prompt** (`src/lib/ai/agent-prompt.ts`, 437 líneas): la sección *Misión* abre con "Debes **auditar rigurosamente** documentos técnicos…" y ~60% del cuerpo es el playbook de auditoría de presupuestos (ciclo documental, hallazgos, totales, provenance de cifras). La gestión operativa (cronograma, HSE, clima, finanzas, acopios) es una sección entre veinte. Con ese balance, el modelo gravita a auditoría ante cualquier ambigüedad.
2. **La UX de apertura** (`src/components/chat/AgentGreeting.tsx`): los 4 `QUICK_PROMPTS` son 100% presupuesto/auditoría, y el hero es un dropzone de archivos — el mensaje implícito es "subí algo para auditar".
3. **El monolito**: el prompt completo se inyecta SIEMPRE, sin importar el scope. El `capability-registry` de Agent Core existe pero no modula el prompt: es metadata de auditoría, no comportamiento.

**La visión real según la documentación canónica** (EXPLICACION_PROYECTO_PARA_VOS, 06, 07, 08):

> "EdificIA quiere ser el **sistema operativo de una empresa constructora**" · "El chat es una interfaz, **no el centro** del producto" · "que EdificIA opere como un **Project Manager Digital continuo, trazable y mantenible**" · "Las conversaciones deben ser **un canal dentro de un expediente operativo**".

La auditoría es **una capacidad** (`document.audit`, `budget.audit`) entre siete (`context.search`, `project.brief`, `operations.update`, `documents.generate`, `communications.*`). El agente correcto abre con *"esto pasa hoy en tu obra"* — no con *"¿qué auditamos?"*.

**Qué NO es el problema** (conservar): los patrones de calidad del prompt actual son buenos y se mantienen — bloque `<plan>`, `<hypothesis>`, retry estructurado, provenance de cifras, self-check, invariantes anti-invención. El problema es la *identidad y el balance*, no la disciplina.

---

## Etapa 1 — Documentación: borrar vestigios y redocumentar (sin código)

1. **Borrar `ROADMAP.md`** (autorizado por el dueño; la historia queda en git). Su contenido vivo se reduce a:
2. **Crear `docs/00_PRODUCTO.md`** — el único doc vivo de estado: visión en 10 líneas (citando la canónica), estado actual del sistema (post-desconexión), pendientes reales (cortos, sin los ✅ históricos), y el modelo `Empresa → Obra → Expediente`. Reemplaza a ROADMAP + PROXIMOS_PASOS (este último se archiva).
3. **Reescribir `docs/04_architecture_map.md`**: el diagrama Mermaid todavía muestra InsForge BaaS y Qdrant Cloud como dependencias activas. Nuevo mapa: Next.js (UI/BFF + tools) · `src/lib/db` (pg) · pgvector · auth local · storage FS · `services/agent` (cerebro Python) · DeepSeek/NVIDIA como únicos externos.
4. **Actualizar `EXPLICACION_PROYECTO_PARA_VOS.md`** solo en la tabla de stack (§4, menciona InsForge/Qdrant); el resto está vigente y es la referencia de visión.
5. **`CLAUDE.md` / `AGENTS.md`**: quitar "leer ROADMAP.md al inicio" → apuntar a `docs/00_PRODUCTO.md`; **eliminar de la lista "NO tocar"** a `agent-prompt.ts` y `agent-tools*.ts` (esa regla protege exactamente lo que hay que rediseñar); registrar la decisión de producto nueva: *"la identidad del agente es PM Digital; auditoría es una capacidad bajo demanda"*.
6. **Podar `docs/AI_WORKLOG.md`** según su propia regla (entradas completadas y reflejadas se borran).
7. Archivar `docs/PROXIMOS_PASOS.md` (sus 4 items vivos pasan a `00_PRODUCTO.md`).

*Esfuerzo: ~1 h. No requiere ningún servicio levantado.*

## Etapa 2 — Reposicionar identidad: prompt modular + apertura operativa

1. **Reescribir `agent-prompt.ts` como composición por capacidades** (aprovechando `agent-core/capability-registry`):
   - `core.md` (identidad + invariantes + estilo, ~40 líneas): *"Sos el Project Manager Digital de {empresa}. Tu trabajo es que la obra avance: estado, riesgos, vencimientos, decisiones con evidencia. Auditás documentos cuando llega un documento o te lo piden — no es tu apertura por defecto."*
   - Módulos por capacidad que se inyectan según scope y señal del turno: `operations` (brief, cronograma, HSE, clima, acopios, curva S), `document-audit` (el playbook actual, solo cuando hay archivo/intención), `budget-audit`, `generate`, `communications`, `memory/graph`.
   - Beneficio doble: corrige el sesgo Y baja ~50-70% los tokens de prompt por turno (hoy: 23k tokens de input por "hola").
2. **Regla de apertura nueva**: con obra activa y sin archivo, el primer turno consulta señales operativas (`operational_findings` abiertos, vencimientos HSE próximos, tareas bloqueadas — vía `resumen_diario_obra`) y abre con el estado del día + 1 acción sugerida. Sin obra activa, abre a nivel empresa (cobertura, obras con riesgo).
3. **`AgentGreeting.tsx`**: quick-prompts contextuales por estado de la obra — "¿Cómo arranca el día en {obra}?", "¿Quién puede ingresar hoy? (HSE)", "¿Cómo viene la curva de inversión?", "¿Llueve esta semana? ¿qué reprogramo?" — y el dropzone pasa a ser una opción más, no el hero. Los prompts de auditoría aparecen cuando hay documentos recientes sin auditar.
4. Ambos backends (TS y Python) consumen el mismo prompt compuesto: el TS vía `buildSystemPrompt`, el Python vía `/api/internal/agent/context` (ya recibe el prompt armado — cero divergencia).

*Esfuerzo: ~1 día. Para iterar prompts solo hace falta Postgres + `npm run dev` (sin servicio Python).*

## Etapa 3 — Especialización real en el cerebro Python

1. **Modos especializados** en `services/agent/app/core/`: un clasificador de intención liviano (reglas + el router existente) elige el modo del turno — `operaciones` / `documentos` / `finanzas` / `generación` — y cada modo recibe **su módulo de prompt + un subset del manifest de tools** (filtrar las 40+ tools por modo). Esto elimina estructuralmente el "todo es auditoría": el modo operaciones ni siquiera ve `detectar_exclusiones_logicas`.
2. **Proactividad en el turno**: inyectar al contexto los `operational_findings` abiertos y vencimientos próximos del scope (hoy solo se inyectan memorias). El agente menciona riesgos sin que se los pregunten — el corazón del "PM continuo".
3. **Reflexión de expedientes**: al cerrar un expediente (`proponer_cierre_expediente`), destilar el caso completo a memoria (qué tipo de caso, qué evidencia decidió, qué corrigió el humano) — hoy la reflexión es solo por turno.
4. **Evals**: `services/agent/evals/` con 12-15 conversaciones doradas (mayoría operativas: brief, HSE, clima, reprogramación, curva S; minoría documentales) + script que corre contra DeepSeek y verifica conducta (¿abrió operativo? ¿citó evidencia? ¿llamó la tool correcta?). Es el reemplazo del smoke de 3 saludos: mide lo que importa.

*Esfuerzo: 1-2 días. Requiere Postgres + web + uvicorn solo al correr evals end-to-end; el desarrollo de prompts/modos se prueba con evals directos contra DeepSeek (sin web).*

## Etapa 4 — Criterios de aceptación

- "Hola" con obra activa → abre con estado operativo del día (findings/vencimientos reales), **cero** mención a auditar.
- "¿Puede entrar la cuadrilla de X?" → modo operaciones, `verificar_ingreso_personal`, sin desvíos documentales.
- Sube un Excel de presupuesto → el playbook de auditoría completo sigue funcionando igual de bien (no romper la capacidad, des-centrarla).
- Tokens de prompt por turno simple: de ~23k a <10k.
- Evals: 100% de las conversaciones doradas pasan sus asserts de conducta.

## Notas operativas

- **Consumo de máquina**: nada de este plan exige tener todo levantado. Mínimo permanente: solo Postgres (`docker compose up -d postgres`, ~100 MB RAM). Para apagar todo: `colima stop`. La web y el servicio Python se levantan solo al validar.
- **Orden recomendado**: Etapa 1 → 2 → 3 → 4. La 1 y la 2 son independientes del servicio Python; si un día se decide que el cerebro vive 100% en Python, la Etapa 2 ya dejó el prompt modular y portable.
- **Fuera de alcance de este plan**: conectores externos (Drive/SQL), URL pública/schedule, migrar tools TS→Python (sigue siendo gradual, posterior).
