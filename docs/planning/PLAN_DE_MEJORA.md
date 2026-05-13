# Plan de Mejora y Despliegue: EdificIA

Este documento sirve como hoja de ruta para las próximas implementaciones en el proyecto EdificIA. Está formateado para que asistentes como Claude Code puedan leerlo y ejecutar los pasos de forma secuencial. Se han agregado casillas de verificación para dar seguimiento a su estado actual.

## 1. Montaje y Dockerización (Servidor y Servicios)
**Objetivo:** Contenerizar la aplicación para facilitar su despliegue en cualquier servidor (VPS, AWS, etc.) y unificar el entorno de desarrollo.

- **[x] Paso 1: Dockerfile para Next.js:** 
  - Crear un `Dockerfile` en la raíz del proyecto configurado para Next.js en modo `standalone`. Esto reduce drásticamente el peso de la imagen de producción.
- **[~] Paso 2: Orquestación con Docker Compose (`docker-compose.yml`):**
  - Definir el servicio `web` (Next.js). *(Completado)*
  - Definir un servicio `qdrant` (Base de datos vectorial) local para evitar depender siempre de Qdrant Cloud en desarrollo. Mapear volúmenes (`./qdrant_data:/qdrant/storage`) para persistencia. *(Completado)*
  - Definir un servicio `postgres` (si se desea reemplazar InsForge temporalmente para desarrollo local) con su volumen correspondiente. *(Pendiente)*
- **[x] Paso 3: Variables de entorno:**
  - Actualizar `.env.local.example` y crear un `.env.docker` que conecte automáticamente los servicios dentro de la red de Docker.

## 2. Persistencia por Base de Datos
**Objetivo:** Asegurar que tanto los datos relacionales (usuarios, obras) como los vectoriales (documentos RAG) no se pierdan al reiniciar el servidor.

- **[x] Paso 1: Configuración de Volúmenes Docker:** Como se mencionó en el paso anterior, asegurar que la base de datos relacional y vectorial apunten a volúmenes físicos en el host.
- **[ ] Paso 2: Migraciones Automáticas:** Asegurar que el script de inicio del contenedor o el CI/CD ejecute `npm run migrate` (usando InsForge o Drizzle/Prisma) antes de levantar la app. *(Scripts creados pero falta automatización en el arranque)*

## 3. Monitoreo del Estado de los Servicios
**Objetivo:** Tener visibilidad en tiempo real de si el frontend, la base de datos relacional y Qdrant están operativos.

- **[x] Paso 1: Endpoint de Health Check (`/api/health`):**
  - Crear una ruta GET en Next.js que haga un ping a PostgreSQL y otro a Qdrant.
  - Retornar estado HTTP 200 si todo está OK, o 503 si algún servicio falla, junto con un JSON detallando el estado de cada uno.
- **[~] Paso 2: Docker Healthchecks:**
  - Integrar `healthcheck` en el `docker-compose.yml` para que Docker sepa si un contenedor está realmente listo para recibir tráfico, asegurando que el backend no inicie antes que la DB. *(Qdrant implementado, Next.js web pendiente)*

## 4. Conexión y Consistencia Frontend-Backend
**Objetivo:** Garantizar que la comunicación en el monorepo (Next.js) sea robusta y segura.

- **[x] Paso 1: Validación E2E:** Asegurar que todas las peticiones a la API utilicen los esquemas de Zod definidos en `src/lib/validators` para validar tanto los body de las requests (Frontend) como las respuestas (Backend).
- **[x] Paso 2: Manejo de errores global:** Estandarizar las respuestas de error de la API y capturarlas en el Frontend usando interceptores o manejadores de TanStack Query para mostrar *toasts* informativos al usuario.

## 5. Mejora en la Información y Base de Datos (RAG)
**Objetivo:** El agente debe recibir mejor contexto y metadatos de lo que lee.

- **[x] Paso 1: Enriquecimiento de Metadatos:** Al procesar un PDF/Excel/DXF, no solo extraer el texto, sino guardar en Qdrant metadatos como: `autor`, `fecha_creacion`, `tipo_documento` (plano, presupuesto, memoria), y `obra_id`.
- **[x] Paso 2: Pre-procesamiento Inteligente:** Mejorar el `file-processor`. Si es un Excel, formatearlo como tabla Markdown antes de vectorizarlo. Si es un plano DXF, extraer capas y cotas de forma estructurada.
- **[ ] Paso 3: Búsqueda Híbrida:** Configurar Qdrant para usar no solo búsqueda por similitud semántica (embeddings), sino combinarla con búsqueda por palabras clave exactas (BM25) para términos técnicos muy específicos de ingeniería.

## 6. Mejora de Interfaz y System Prompt
**Objetivo:** Hacer la subida de archivos intuitiva y profesional, y darle al agente reglas estrictas de comportamiento.

- **[ ] Paso 1: UI de Subida (Estética):**
  - Rediseñar el componente de subida en `src/components/chat/` o `documents/`. *(Componente base creado)*
  - Usar un área de *Drag & Drop* de Shadcn con animaciones de Framer Motion. *(Pendiente)*
  - Mostrar barras de progreso reales durante la extracción de texto y el guardado en Qdrant. *(Pendiente)*
- **[x] Paso 2: Refinamiento del System Prompt (Transición a "El Mejor Ayudante"):**
  - Actualizar el archivo de prompt (`src/lib/ai/agent-prompt.ts`).
  - Añadir directivas estrictas de citado (siempre citar el documento y la página usando metadatos).
  - **Evolución de Rol**: Ya no es solo un "Auditor Técnico Senior" pasivo, sino **EL MEJOR AYUDANTE**. Debe mantener la precisión técnica, pero sumar un rol de gestión integral: llevar la cronología de las obras, disponer de contactos (obreros, servicios) y analizar proactivamente el estado del proyecto.

## 7. Seguridad y Resiliencia en Producción
**Objetivo:** Garantizar que la aplicación sea segura, robusta y escalable para entornos empresariales, protegiendo los datos y asegurando la continuidad del servicio.

- **[x] Paso 1: Aislamiento y Control de Acceso:**
  - **Multi-tenancy:** Implementar aislamiento estricto de datos. Cuando un usuario hace log in, solo debe poder acceder a los datos de su propia empresa (implementar Row-Level Security en la base de datos o filtros obligatorios por `company_id`).
  - **Políticas de CORS (CORS Policy):** Configurar políticas restrictivas para asegurar que solo dominios autorizados puedan hacer peticiones a la API.
  - **Seguridad en Password Reset:** Implementar flujos seguros con tokens de un solo uso, expiración corta y mitigación contra ataques de enumeración de usuarios.
- **[x] Paso 2: Protección contra Ataques y Abusos:**
  - **Input Validation y Sanitización:** Validar tipos y sanitizar estrictamente todas las entradas (ej. con Zod) para bloquear ataques de inyección (SQL Injection, NoSQL Injection, XSS).
  - **Rate Limiting:** Implementar limitación de tasa (rate limiting) en endpoints críticos para prevenir fuerza bruta, scraping o ataques de denegación de servicio (DDoS).
- **[~] Paso 3: Optimización y Manejo de Errores:**
  - **Database Indexes:** Analizar consultas recurrentes y crear índices adecuados para mantener el rendimiento a medida que los datos escalan. *(Depende de migraciones completas)*
  - **Manejo de Errores (Error Handling):** Implementar fallbacks limpios y amigables para los usuarios (clean fallbacks). Nunca exponer *stack traces* o información sensible del sistema en producción. *(Implementado con validadores y fallbacks de API)*
- **[ ] Paso 4: Observabilidad y Recuperación:**
  - **Logging en Producción:** Implementar un sistema de logs estructurado que permita debuggear problemas eficientemente en producción.
  - **Sistema de Alertas (Alert System):** Configurar monitoreo proactivo para que el equipo reciba notificaciones inmediatas si algo se rompe.
  - **Write-Ahead Logging (WAL):** Asegurar que WAL esté activado en la base de datos para garantizar la durabilidad de las transacciones y prevenir corrupción de datos ante caídas repentinas.
  - **Estrategia de Rollback:** Diseñar un plan automatizado para revertir rápidamente a la versión anterior si un nuevo despliegue causa fallos críticos.

## 8. Funciones Proactivas y Gestión Integral de Obra
**Objetivo:** Evolucionar de un consultor reactivo a "El Mejor Ayudante, a Prueba de Balas". El agente debe entender y anticiparse a todas las variables críticas de una obra real: clima, cadena de suministros, seguridad del personal y finanzas.

- **[ ] Paso 1: Arquitectura de Datos Extendida para la Obra Real:**
  - **Cronograma y Finanzas:** Registro de curva de inversión, hitos de Certificados de Avance y pagos a subcontratistas.
  - **Directorio y Subcontratos:** Base de datos de obreros, cuadrillas, proveedores y servicios de alquiler (ej. grúas, volquetes).
  - **HSE (Salud, Seguridad y Medio Ambiente):** Control de pólizas de seguros (ART), fechas de vencimiento de permisos municipales, y control de entrega de EPP (Elementos de Protección Personal).
  - **Acopios y Suministros:** Control de inventario en obra, seguimiento de órdenes de compra críticas (ej. fechas de colada de hormigón, llegada de perfilería).

- **[ ] Paso 2: Motor de Proactividad y Clima (Notificaciones Inteligentes):**
  - Implementar un sistema de background (CRON jobs / Workers) que analice el estado de la obra cada día.
  - **Integración Meteorológica:** El agente revisará el clima y cruzará los datos con el cronograma. (Ej. *"Aviso: Dan lluvia intensa para el jueves. Sugiero reprogramar el hormigonado de la losa 2 y reasignar a esa cuadrilla a tareas de mampostería interior"*).
  - **Alertas Preventivas:** Enviar notificaciones (Mail/Push) si el seguro de un subcontratista vence mañana (para no dejarlo entrar a la obra) o si falta pedir el material para la semana que viene.

- **[ ] Paso 3: Tools Avanzadas para el Agente IA:**
  - Dotar al agente de herramientas (Tool Calling) para gestionar la realidad de la obra:
    - `evaluar_impacto_clima(fecha)`: Cruza clima vs. tareas de ruta crítica.
    - `verificar_ingreso_personal(cuadrilla)`: Valida seguros, ART y capacitaciones antes de autorizar ingreso.
    - `reprogramar_e_informar(tarea, fecha)`: Mueve una tarea en el Gantt y genera borradores de mensajes/emails para enviar a los capataces.
    - `auditar_curva_inversion()`: Compara lo gastado vs. el avance físico real para alertar sobre desfasajes de caja.
