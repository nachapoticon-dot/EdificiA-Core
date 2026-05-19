# EdificIA explicado para vos

> Este documento es para entender el proyecto con calma. No está escrito para venderlo ni para otro agente: está escrito para que vos puedas leerlo, volver cuando te pierdas y armar un mapa mental real de qué construiste.

---

## 1. La idea central

EdificIA es un sistema para constructoras. La forma corta de decirlo es:

> EdificIA quiere ser el sistema operativo de una empresa constructora, con un agente de IA que entiende obras, documentos, presupuestos, riesgos y decisiones.

No es solamente un chat. El chat es una interfaz, pero el producto apunta a algo más grande:

- organizar empresas constructoras;
- manejar obras;
- leer documentos técnicos;
- detectar contradicciones;
- crear expedientes operativos;
- registrar evidencia;
- auditar presupuestos y documentos;
- generar reportes, órdenes de compra, actas e informes;
- detectar riesgos automáticamente;
- dejar trazabilidad de por qué el agente dijo algo.

La idea importante es esta:

> El valor no está en que el usuario le hable a una IA. El valor está en que la IA trabaje sobre el contexto real de la empresa y deje cada decisión conectada con evidencia.

---

## 2. El modelo mental del producto

El proyecto está ordenado alrededor de este modelo:

```text
Empresa
  -> Obra
    -> Expediente Operativo
      -> Eventos
      -> Evidencias
      -> Acciones
      -> Artefactos
```

Vamos parte por parte.

### Empresa

Una empresa es el tenant principal. En la base aparece como `organization`.

Ejemplo:

```text
Constructora Norte S.A.
```

Todo dato privado pertenece a una empresa. Esto es clave porque EdificIA es multi-tenant: muchas empresas podrían usar el mismo sistema, pero nunca deben ver datos entre sí.

Por eso casi todas las tablas importantes tienen:

```text
organization_id
```

Esa columna es la frontera de seguridad más importante del proyecto.

### Obra

Una obra es un proyecto de construcción.

Ejemplo:

```text
Torre Norte
Hospital Municipal
Barrio 42 viviendas
```

En la base aparece como `projects`.

Una obra agrupa:

- documentos;
- presupuestos;
- cronograma;
- HSE/seguridad;
- acopios;
- subcontratos;
- reportes;
- alertas;
- expedientes.

### Expediente Operativo

Un expediente es una unidad de trabajo.

Ejemplos:

```text
Auditoría del presupuesto V2
Revisión documental de contrato eléctrico
Análisis de atraso de hormigón
Chequeo HSE de ingreso de cuadrilla
```

Antes el producto giraba más alrededor de sesiones de chat. Eso sirve para conversar, pero no alcanza para operación real. Una constructora no piensa en "chats"; piensa en casos, decisiones, auditorías, tareas y evidencia.

Por eso se creó el Agent Core:

- `work_cases`: expediente;
- `work_case_events`: bitácora del expediente;
- `work_case_evidence`: evidencia vinculada;
- `agent_runs`: ejecuciones del agente.

### Eventos

Un evento es algo que pasó dentro del expediente.

Ejemplos:

```text
chat.turn_completed
work_case.status_changed
chat_session.linked
```

Sirve para reconstruir la historia de una auditoría.

### Evidencias

Una evidencia es una pieza que justifica algo.

Puede ser:

- un archivo;
- un chunk de documento;
- una relación del grafo;
- un hallazgo;
- un mensaje;
- una tarea de cronograma;
- un registro HSE;
- un reporte documental.

La evidencia responde a una pregunta clave:

> ¿En qué se basó EdificIA para decir esto?

### Acciones

Una acción es algo que el sistema o el agente hace.

Ejemplos:

- registrar un acopio;
- reprogramar una tarea;
- generar una orden de compra;
- cerrar un expediente;
- resolver una contradicción documental.

### Artefactos

Un artefacto es una salida usable por la empresa.

Ejemplos:

- `.docx` de orden de compra;
- acta de obra;
- informe;
- presupuesto exportado;
- resumen diario.

---

## 3. Qué problema intenta resolver

En una constructora real, la información suele estar partida:

- presupuestos en Excel;
- planos en PDF/DXF;
- contratos en Word/PDF;
- certificados en carpetas;
- conversaciones por WhatsApp;
- decisiones en mails;
- avances en planillas;
- HSE en legajos;
- compras en otra herramienta;
- cronograma en otra planilla.

El problema no es solamente guardar archivos. El problema es entenderlos y conectarlos.

EdificIA apunta a responder preguntas como:

```text
¿Este presupuesto contradice el anterior?
¿Qué documento es la versión vigente?
¿Esta persona puede ingresar a obra?
¿Qué partidas explican el desvío?
¿Qué obras tienen alertas críticas hoy?
¿Qué evidencia respalda este cierre?
¿Por qué el agente marcó este riesgo?
```

Esto cambia la lógica del producto:

- no alcanza con subir archivos;
- no alcanza con chatear;
- no alcanza con hacer RAG genérico;
- hace falta contexto empresarial, trazabilidad y reglas de dominio.

---

## 4. Stack técnico explicado simple

El proyecto usa varias tecnologías. La idea no es que sepas todas perfecto, sino que entiendas para qué sirve cada una.

| Parte | Tecnología | Para qué sirve |
|---|---|---|
| App web | Next.js | Pantallas y API routes en el mismo proyecto |
| Lenguaje | TypeScript | JavaScript con tipos para evitar errores |
| UI | React + Tailwind + Shadcn | Componentes visuales |
| Estado cliente | TanStack Query | Cargar datos del backend y cachearlos |
| IA | Vercel AI SDK + DeepSeek | Streaming del chat y tools del agente |
| Backend/Auth/Storage | InsForge | Usuarios, base Postgres, storage |
| Base de datos | PostgreSQL | Datos principales del producto |
| Vector DB | Qdrant | Búsqueda semántica de documentos |
| Validación | Zod | Verificar inputs/outputs con schemas |
| Logs | Pino | Logs estructurados |
| Documentos | docx, xlsx, jsPDF | Generar/leer archivos |

Una forma simple de verlo:

```text
Next.js = la app
React = pantallas
API routes = backend
InsForge/Postgres = base de datos y usuarios
Qdrant = memoria semántica de documentos
AI SDK + DeepSeek = agente conversacional con tools
Zod = guardarraíl de datos
```

---

## 5. Cómo está organizado el repo

Las carpetas más importantes:

```text
src/app/
```

Contiene pantallas y rutas API de Next.js.

Ejemplos:

```text
src/app/dashboard/chat/page.tsx
src/app/dashboard/obras/[id]/page.tsx
src/app/api/chat/route.ts
src/app/api/upload/route.ts
```

---

```text
src/components/
```

Componentes visuales reutilizables.

Ejemplos:

```text
src/components/chat/
src/components/ui/
src/components/super-admin/
```

---

```text
src/hooks/
```

Hooks de React para cargar datos.

Ejemplos:

```text
useProjects()
useWorkCases()
useCurrentUser()
useOrgMember()
```

Un hook suele vivir del lado cliente y llamar a una API.

---

```text
src/lib/
```

La lógica fuerte del sistema.

Ahí vive casi todo lo importante:

```text
src/lib/ai/
src/lib/agent-core/
src/lib/rag/
src/lib/document-intelligence/
src/lib/knowledge-graph/
src/lib/proactivity/
src/lib/project-operations/
src/lib/auth/
src/lib/validators/
```

---

```text
migrations/
```

Cambios de base de datos.

Cada archivo SQL crea o modifica tablas, columnas, índices o políticas RLS.

---

```text
docs/
```

Documentación del proyecto.

Los archivos más importantes:

```text
ROADMAP.md
docs/04_architecture_map.md
docs/AI_WORKLOG.md
docs/03_domain_knowledge.md
docs/06_enterprise_context_layer.md
docs/07_agentic_document_reading.md
docs/08_agent_core_redesign.md
```

---

## 6. Cómo funciona el login y la seguridad

EdificIA usa InsForge para auth.

El flujo simple:

1. El usuario entra a `/login`.
2. Se autentica con InsForge.
3. El frontend guarda el token.
4. También se crea una cookie `edificia_session`.
5. `src/proxy.ts` protege `/dashboard/*`.
6. Cada API privada llama a `requireAuth(req)`.
7. `requireAuth` devuelve usuario, organización y rol.

Roles actuales:

```text
admin
engineer
viewer
```

La regla más importante:

> Toda API privada tiene que usar `requireAuth(req)` y filtrar datos por `auth.orgId`.

Ejemplo conceptual:

```ts
const auth = await requireAuth(req);
if (auth instanceof Response) return auth;

const result = await db
  .from("projects")
  .select("*")
  .eq("organization_id", auth.orgId);
```

Eso evita que una empresa lea datos de otra.

---

## 7. Multi-tenant explicado simple

Multi-tenant significa que el mismo sistema puede servir a muchas empresas.

Ejemplo:

```text
Empresa A: Constructora Norte
Empresa B: Obras Sur
```

Ambas usan EdificIA, pero sus datos no se mezclan.

Por eso:

- casi toda tabla tiene `organization_id`;
- las queries filtran por `organization_id`;
- PostgreSQL usa RLS;
- el backend no debe confiar en IDs enviados por el cliente.

RLS significa Row Level Security. Es una capa de seguridad en la base de datos que decide qué filas puede leer/escribir cada usuario.

Aunque haya un bug en una query, RLS ayuda a reducir el riesgo. Pero no reemplaza hacer bien las queries.

---

## 8. Qué pasa cuando el usuario sube un archivo

Ruta principal:

```text
POST /api/upload
src/app/api/upload/route.ts
```

Flujo resumido:

1. Verifica auth.
2. Rechaza `viewer` si intenta subir.
3. Valida tamaño y extensión.
4. Procesa el archivo con `processFile`.
5. Guarda el archivo en Storage.
6. Crea registro en `uploaded_files`.
7. Extrae texto/datos.
8. Escanea PII.
9. Busca contradicciones con documentos previos.
10. Ingesta el documento para RAG.
11. Crea reporte documental.
12. Crea relaciones semánticas en el knowledge graph.
13. Devuelve resultado al frontend.

El upload no es "guardar archivo y listo". Es un pipeline de inteligencia documental.

### Tipos de archivo

Soporta:

- Excel;
- CSV;
- PDF;
- Word;
- DXF;
- imágenes;
- DWG no se procesa directamente, se rechaza con guía.

### PII scan

Busca datos sensibles como:

- CUIT/CUIL;
- DNI;
- CBU;
- emails;
- teléfonos.

Si encuentra algo, lo marca como riesgo.

### Context scan

Compara el nuevo documento con otros documentos de la misma empresa/obra.

Ejemplo:

```text
Presupuesto V1 dice total: $100.000.000
Presupuesto V2 dice total: $130.000.000
```

Eso puede ser correcto, pero requiere atención. El sistema lo registra como hallazgo contextual.

---

## 9. RAG explicado simple

RAG significa Retrieval-Augmented Generation.

En castellano práctico:

> Antes de responder, el agente busca información relevante en documentos guardados y usa eso como contexto.

Flujo:

1. Se procesa un documento.
2. Se divide en fragmentos.
3. Cada fragmento se convierte en un embedding.
4. Ese embedding se guarda en Qdrant.
5. Cuando el usuario pregunta, se busca semánticamente.
6. El agente recibe los fragmentos relevantes.
7. Responde con más contexto.

Qdrant no guarda "archivos" como una carpeta. Guarda vectores, que sirven para búsqueda por significado.

Ejemplo:

```text
Usuario: "¿Hay diferencia entre el presupuesto viejo y el nuevo?"
Sistema: busca documentos relacionados en Qdrant.
Agente: usa esos resultados para comparar.
```

---

## 10. Knowledge graph explicado simple

El knowledge graph conecta documentos entre sí.

Tabla principal:

```text
obra_relations
```

Tipos de relación:

```text
contradicts
derives_from
supersedes
references
duplicates
```

Ejemplos:

```text
Presupuesto V2 supersedes Presupuesto V1
Certificado mayo derives_from Presupuesto base
Plano estructura contradice Cómputo métrico
```

Esto importa porque una empresa no necesita solo "buscar archivos". Necesita entender cómo se relacionan.

El sistema ya puede:

- detectar contradicciones numéricas;
- detectar versiones por nombre de archivo;
- detectar documentos derivados por referencias a códigos/tareas;
- exponer un dump por API para visualización externa.

---

## 11. Contexto Empresarial

La Base Documental está evolucionando a Contexto Empresarial.

La diferencia:

```text
Base documental = archivos subidos.
Contexto empresarial = conocimiento conectado de toda la empresa.
```

Tablas nuevas:

```text
enterprise_sources
enterprise_documents
enterprise_sync_runs
```

Hoy el slice 1 hace:

- backfill desde archivos subidos;
- inventario documental;
- búsqueda contextual en `/dashboard/contexto`;
- API `GET /api/enterprise-context/search`;
- conecta documentos, obras, expedientes y relaciones.

La visión futura es que EdificIA se conecte en modo read-only a fuentes reales:

- Google Drive;
- SharePoint;
- carpetas internas;
- exports de ERP;
- SQL externos;
- sistemas de compras o gestión.

El punto clave:

> EdificIA no debería depender solo de archivos que el usuario sube manualmente. Debería construir contexto desde las fuentes reales de la empresa.

---

## 12. Cómo funciona el chat con IA

Ruta principal:

```text
POST /api/chat
src/app/api/chat/route.ts
```

El frontend manda mensajes. El backend:

1. valida auth;
2. lee obra activa y sesión;
3. resuelve contexto del Agent Core;
4. decide qué modelo usar;
5. arma prompt;
6. conecta tools;
7. llama a DeepSeek vía Vercel AI SDK;
8. streamea la respuesta;
9. al terminar guarda telemetría, audit log y agent run.

### Router de modelos

Archivo:

```text
src/lib/ai/model-router.ts
```

Decide si usar modo:

```text
fast
deep
```

Usa señales como:

- archivo adjunto;
- comparación A vs B;
- contradicciones;
- pedido de análisis profundo;
- conversación larga.

### Tools

Las tools son funciones que el agente puede llamar.

Ejemplos:

- buscar en base documental;
- comparar presupuestos;
- verificar ingreso de personal;
- auditar curva de inversión;
- registrar HSE;
- generar orden de compra;
- cerrar expediente.

Regla importante:

> Las tools son instrumentos. El razonamiento no debe estar hardcodeado como una lista tonta de pasos.

Por eso el prompt le pide al agente:

- clasificar;
- formar hipótesis;
- buscar evidencia;
- contrastar;
- verificar;
- sintetizar.

---

## 13. Qué es el Agent Core

El Agent Core es el intento de ordenar la IA como parte del producto, no como un chat suelto.

Archivos principales:

```text
src/lib/agent-core/
```

Incluye:

- tipos de scope;
- capacidades del agente;
- runtime context;
- writer de agent runs;
- writer de work cases;
- cierre agéntico de expedientes.

El scope puede ser:

```text
company
project
work_case
```

Significa:

- `company`: el agente opera a nivel empresa;
- `project`: opera dentro de una obra;
- `work_case`: opera dentro de un expediente específico.

Esto evita respuestas fuera de contexto.

---

## 14. Expedientes Operativos

Los expedientes son una de las partes más importantes del producto.

Tablas:

```text
work_cases
work_case_events
work_case_evidence
agent_runs
document_intelligence_reports
```

Un expediente tiene:

- título;
- tipo;
- estado;
- resumen;
- veredicto;
- evidencia;
- eventos;
- ejecuciones del agente.

Estados posibles:

```text
open
in_progress
waiting
resolved
closed
archived
```

Veredictos posibles:

```text
approved
flagged
inconclusive
rejected
superseded
```

Ejemplo:

```text
Expediente: Auditoría Presupuesto Torre Norte V2
Estado: resolved
Veredicto: flagged
Resumen: Se detectó diferencia del 18% contra versión anterior...
Evidencia: presupuesto V1, presupuesto V2, relación supersedes, reporte documental
```

Esto permite que EdificIA no sea una conversación perdida, sino un sistema auditable.

---

## 15. Qué significa "Por qué" y replay de auditoría

Una buena IA empresarial no solo responde. Tiene que justificar.

Por eso se agregó:

- "Por qué" expandible en hallazgos/riesgos;
- replay de auditoría;
- `agent_runs`;
- tool telemetry;
- evidencia vinculada.

Cuando el usuario abre un expediente puede ver:

- qué modelo se usó;
- tier fast/deep;
- cantidad de pasos;
- tools llamadas;
- errores de tools;
- reintentos;
- latencia;
- payload técnico;
- eventos del expediente;
- evidencias.

Esto apunta a una idea fuerte:

> Si el agente toma o recomienda una decisión, la empresa debe poder auditar cómo llegó ahí.

---

## 16. Proactividad

La proactividad es que el sistema detecte riesgos sin que el usuario pregunte.

Archivo:

```text
src/lib/proactivity/daily-scan.ts
```

Ruta:

```text
/api/cron/project-proactivity
```

Tabla:

```text
operational_findings
```

Detecta riesgos como:

- tareas vencidas;
- tareas bloqueadas;
- documentación vieja;
- HSE vencido;
- acopios insuficientes;
- desvíos financieros.

La tabla `operational_findings` es un read model vivo. Eso significa que representa el estado actual de alertas. No es lo mismo que `audit_log_events`, que es histórico e inmutable.

Pendiente real:

```text
Falta activar el schedule diario con una URL pública.
```

El endpoint existe, pero si el deploy apunta a localhost no hay forma de que un scheduler externo lo llame.

---

## 17. Alertas del sistema

Se agregó un sistema local similar a Sentry, pero dentro de la app.

Tabla:

```text
app_error_events
```

Helper:

```text
src/lib/observability/error-events.ts
```

Vista:

```text
/dashboard/admin/errors
```

Sirve para capturar errores de rutas críticas:

- chat;
- cron de proactividad;
- contexto empresarial;
- findings;
- upload;
- reindex.

Cada evento guarda:

- organización;
- ruta;
- método;
- severidad;
- mensaje;
- stack;
- fingerprint;
- contexto;
- fecha;
- si está resuelto.

Esto no reemplaza logs, pero ayuda a operar el producto desde el dashboard.

---

## 18. Audit log

El audit log es distinto al sistema de alertas.

Tabla:

```text
audit_log_events
```

Sirve para registrar eventos importantes de negocio y trazabilidad.

Ejemplos:

```text
upload.file_ready
chat.completed
schedule.rescheduled
project.proactivity_scan
email.stakeholder_sent
```

Es append-only: se escribe, pero no se modifica.

Esto es importante porque en construcción muchas decisiones tienen consecuencias. Conviene poder reconstruir qué pasó.

---

## 19. Zod y validación

Zod aparece mucho en el proyecto.

Archivo importante:

```text
src/lib/validators/api-responses.ts
```

Zod sirve para validar datos.

Ejemplo conceptual:

```ts
const schema = z.object({
  id: z.string(),
  name: z.string(),
});

schema.parse(data);
```

Si `data` no cumple el schema, falla.

Por qué importa:

- evita que el frontend consuma respuestas rotas;
- documenta la forma de los datos;
- reduce bugs silenciosos;
- ayuda con TypeScript.

---

## 20. Frontend: cómo pensar las pantallas

Next.js App Router usa archivos como rutas.

Ejemplos:

```text
src/app/dashboard/chat/page.tsx
```

Se ve en:

```text
/dashboard/chat
```

```text
src/app/dashboard/contexto/page.tsx
```

Se ve en:

```text
/dashboard/contexto
```

```text
src/app/api/chat/route.ts
```

Es la API:

```text
/api/chat
```

Regla simple:

- `page.tsx` suele ser pantalla;
- `route.ts` suele ser API;
- `layout.tsx` envuelve pantallas;
- `components/` contiene piezas reutilizables;
- `hooks/` carga datos para componentes cliente.

---

## 21. Backend: cómo pensar una API route

Una API privada bien hecha suele seguir este patrón:

```ts
export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const client = getInsForgeAdminClient();

  const result = await client.database
    .from("tabla")
    .select("*")
    .eq("organization_id", auth.orgId);

  if (result.error) {
    return Response.json({ error: "Error" }, { status: 500 });
  }

  return Response.json(schema.parse(result.data));
}
```

Puntos importantes:

- validar auth;
- filtrar por organización;
- validar input;
- manejar errores;
- validar output si corresponde;
- no exponer datos de otro tenant.

---

## 22. Base de datos: tablas que deberías reconocer

### Identidad y multi-tenant

```text
organizations
organization_members
organization_invitations
org_founder_invitations
```

### Obras y documentos

```text
projects
uploaded_files
document_chunks
document_intelligence_reports
```

### Chat y agente

```text
chat_sessions
chat_messages
chat_snapshots
agent_runs
```

### Expedientes

```text
work_cases
work_case_events
work_case_evidence
```

### Operación de obra

```text
project_schedule_tasks
project_financial_snapshots
project_subcontracts
project_hse_records
project_supply_items
```

### Inteligencia documental

```text
obra_relations
enterprise_sources
enterprise_documents
enterprise_sync_runs
```

### Observabilidad

```text
audit_log_events
operational_findings
app_error_events
```

---

## 23. Qué es una migración

Una migración es un archivo que cambia la base de datos.

Ejemplo:

```text
migrations/20260519033600_app-error-events.sql
```

Puede crear:

- tablas;
- columnas;
- índices;
- políticas RLS;
- constraints;
- backfills.

Regla del proyecto:

> Las migraciones nuevas van en `migrations/` y se aplican con `npm run migrate`.

No se debe agregar nada nuevo en:

```text
docs/archive/db-migrations-legacy/
```

Eso es histórico.

---

## 24. Tests y verificación

Comandos importantes:

```bash
npm run type-check
npm test
npm run build
```

Qué hace cada uno:

```text
npm run type-check
```

Verifica TypeScript.

```text
npm test
```

Corre tests unitarios con `node:test`.

```text
npm run build
```

Compila la app completa de Next.js.

También existe:

```bash
npm run smoke:chat
```

Ese smoke test habla con DeepSeek real y detecta regresiones del ciclo multi-turn.

Hay un hook pre-push que corre `smoke:chat` cuando se tocan archivos críticos del agente.

---

## 25. Cómo leer el proyecto sin perderte

Si querés entender el proyecto, no empieces leyendo archivos al azar.

Orden recomendado:

1. `ROADMAP.md`
2. `docs/04_architecture_map.md`
3. `docs/08_agent_core_redesign.md`
4. `src/app/api/chat/route.ts`
5. `src/lib/agent-core/runtime.ts`
6. `src/app/api/upload/route.ts`
7. `src/lib/document-intelligence/context-scan.ts`
8. `src/lib/knowledge-graph/relations.ts`
9. `src/app/dashboard/obras/[id]/expedientes/[workCaseId]/page.tsx`
10. `src/lib/validators/api-responses.ts`

La idea es pasar de:

```text
visión general -> arquitectura -> flujos principales -> detalles
```

No al revés.

---

## 26. Cómo pensar cuando quieras agregar algo nuevo

Antes de programar, hacete estas preguntas:

### 1. ¿Esto pertenece a empresa, obra o expediente?

Si es de toda la constructora:

```text
organization_id
```

Si es de una obra:

```text
project_id
```

Si es de una auditoría/caso:

```text
work_case_id
```

### 2. ¿Es estado vivo o histórico?

Estado vivo:

```text
operational_findings
work_cases
uploaded_files.indexing_status
```

Histórico:

```text
audit_log_events
work_case_events
agent_runs
```

### 3. ¿Necesita evidencia?

Si una decisión del agente importa, probablemente necesita:

```text
work_case_evidence
```

### 4. ¿Necesita RLS?

Si toca datos de empresa, sí.

### 5. ¿La API filtra por `auth.orgId`?

Si no, hay riesgo multi-tenant.

### 6. ¿El frontend valida la respuesta?

Si la respuesta alimenta UI importante, conviene schema Zod.

---

## 27. Qué cosas ya están fuertes

El proyecto ya tiene bases importantes:

- auth centralizado;
- multi-tenancy por `organization_id`;
- Agent Core;
- expedientes operativos;
- reportes documentales;
- knowledge graph;
- RAG;
- proactividad con read model;
- audit log inmutable;
- alertas locales;
- generación de documentos;
- UI de contexto empresarial;
- replay de auditoría;
- tests base;
- build funcionando.

Esto ya no es una demo simple. Tiene arquitectura de producto empresarial.

---

## 28. Qué cosas todavía son deuda o futuro

No todo está cerrado.

Pendientes reales:

- activar schedule diario de proactividad con URL pública;
- conectores reales read-only para Contexto Empresarial;
- rol external auditor con links temporales;
- memoria activa escribible;
- rollback automatizado;
- profiling bajo carga real;
- voice input;
- PWA/offline.

También hay cosas que conviene hacer con cuidado:

- no sumar tools sin conectarlas a expedientes/evidencia;
- no convertir el producto en un chat genérico;
- no confiar en IDs del cliente;
- no dejar queries sin `organization_id`;
- no meter lógica de dominio compleja solo en el prompt.

---

## 29. Qué deberías aprender para dominar este proyecto

No necesitás aprender todo al mismo tiempo. Este orden es razonable.

### Nivel 1: base web

- JavaScript moderno;
- TypeScript básico;
- React básico;
- Next.js App Router;
- fetch/API routes.

Objetivo:

> Poder entender una pantalla, una API y cómo se conectan.

### Nivel 2: datos

- PostgreSQL básico;
- relaciones entre tablas;
- índices;
- foreign keys;
- RLS;
- migraciones.

Objetivo:

> Entender por qué `organization_id` es sagrado y cómo se modela una feature.

### Nivel 3: backend de producto

- auth;
- roles;
- validación con Zod;
- manejo de errores;
- logs;
- rate limits;
- storage.

Objetivo:

> Poder crear una API privada sin romper seguridad.

### Nivel 4: IA aplicada

- prompts;
- tools;
- streaming;
- RAG;
- embeddings;
- vector DB;
- evaluación de respuestas;
- trazabilidad.

Objetivo:

> Entender que el agente no es magia: es prompt + contexto + tools + memoria + datos + guardrails.

### Nivel 5: arquitectura de producto

- Agent Core;
- expedientes;
- evidencia;
- audit log;
- read models;
- contexto empresarial;
- proactividad.

Objetivo:

> Poder decidir dónde vive una feature y qué impacto tiene.

---

## 30. Mini glosario

### Tenant

Una empresa usando el sistema.

### Multi-tenant

Varias empresas usando el mismo sistema sin compartir datos.

### RLS

Row Level Security. Seguridad en la base para controlar qué filas puede ver cada usuario.

### API route

Endpoint backend dentro de Next.js.

### Hook

Función de React para manejar estado, efectos o carga de datos.

### RAG

Buscar contexto en documentos antes de responder con IA.

### Embedding

Representación numérica de un texto para buscar por significado.

### Qdrant

Base de datos vectorial donde viven embeddings.

### Tool

Función que el agente puede llamar para hacer algo real.

### Audit log

Registro histórico e inmutable de eventos importantes.

### Read model

Tabla pensada para consultar estado actual fácilmente.

### Work case

Expediente operativo.

### Agent run

Una ejecución del agente: modelo, steps, tools, uso, errores, latencia.

### Knowledge graph

Grafo de relaciones entre documentos.

### Contexto Empresarial

Capa que intenta representar conocimiento real de la empresa, no solo archivos sueltos.

---

## 31. Cómo explicarlo en una frase

Si alguien te pregunta qué es EdificIA:

> Es una infraestructura empresarial para constructoras argentinas que organiza obras, documentos y expedientes, y usa un agente de IA para auditar, detectar riesgos, generar artefactos y dejar evidencia trazable de cada decisión.

Si querés decirlo más simple:

> Es un project manager digital para obras, pero con memoria documental, auditoría y trazabilidad.

---

## 32. Lo más importante que tenés que recordar

Si te quedás con pocas ideas, quedate con estas:

1. EdificIA no es un bot. Es un sistema operativo para constructoras.
2. El chat es una interfaz, no el centro del producto.
3. El centro es `Empresa -> Obra -> Expediente -> Evidencia`.
4. `organization_id` es la frontera de seguridad.
5. El agente debe razonar con documentos, tools y contexto real.
6. Toda decisión importante necesita trazabilidad.
7. `audit_log_events` es historia; `operational_findings` es estado vivo.
8. El knowledge graph conecta documentos.
9. Contexto Empresarial es la evolución de Base Documental.
10. Para crecer bien, cada feature nueva tiene que entrar en la arquitectura, no quedar como parche.
