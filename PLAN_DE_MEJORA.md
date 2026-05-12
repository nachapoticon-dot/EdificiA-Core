# Plan de Mejora y Despliegue: EdificIA

Este documento sirve como hoja de ruta para las próximas implementaciones en el proyecto EdificIA. Está formateado para que asistentes como Claude Code puedan leerlo y ejecutar los pasos de forma secuencial.

## 1. Montaje y Dockerización (Servidor y Servicios)
**Objetivo:** Contenerizar la aplicación para facilitar su despliegue en cualquier servidor (VPS, AWS, etc.) y unificar el entorno de desarrollo.

- **Paso 1: Dockerfile para Next.js:** 
  - Crear un `Dockerfile` en la raíz del proyecto configurado para Next.js en modo `standalone`. Esto reduce drásticamente el peso de la imagen de producción.
- **Paso 2: Orquestación con Docker Compose (`docker-compose.yml`):**
  - Definir el servicio `web` (Next.js).
  - Definir un servicio `qdrant` (Base de datos vectorial) local para evitar depender siempre de Qdrant Cloud en desarrollo. Mapear volúmenes (`./qdrant_data:/qdrant/storage`) para persistencia.
  - Definir un servicio `postgres` (si se desea reemplazar InsForge temporalmente para desarrollo local) con su volumen correspondiente.
- **Paso 3: Variables de entorno:**
  - Actualizar `.env.local.example` y crear un `.env.docker` que conecte automáticamente los servicios dentro de la red de Docker.

## 2. Persistencia por Base de Datos
**Objetivo:** Asegurar que tanto los datos relacionales (usuarios, obras) como los vectoriales (documentos RAG) no se pierdan al reiniciar el servidor.

- **Paso 1: Configuración de Volúmenes Docker:** Como se mencionó en el paso anterior, asegurar que la base de datos relacional y vectorial apunten a volúmenes físicos en el host.
- **Paso 2: Migraciones Automáticas:** Asegurar que el script de inicio del contenedor o el CI/CD ejecute `npm run migrate` (usando InsForge o Drizzle/Prisma) antes de levantar la app.

## 3. Monitoreo del Estado de los Servicios
**Objetivo:** Tener visibilidad en tiempo real de si el frontend, la base de datos relacional y Qdrant están operativos.

- **Paso 1: Endpoint de Health Check (`/api/health`):**
  - Crear una ruta GET en Next.js que haga un ping a PostgreSQL y otro a Qdrant.
  - Retornar estado HTTP 200 si todo está OK, o 503 si algún servicio falla, junto con un JSON detallando el estado de cada uno.
- **Paso 2: Docker Healthchecks:**
  - Integrar `healthcheck` en el `docker-compose.yml` para que Docker sepa si un contenedor está realmente listo para recibir tráfico, asegurando que el backend no inicie antes que la DB.

## 4. Conexión y Consistencia Frontend-Backend
**Objetivo:** Garantizar que la comunicación en el monorepo (Next.js) sea robusta y segura.

- **Paso 1: Validación E2E:** Asegurar que todas las peticiones a la API utilicen los esquemas de Zod definidos en `src/lib/validators` para validar tanto los body de las requests (Frontend) como las respuestas (Backend).
- **Paso 2: Manejo de errores global:** Estandarizar las respuestas de error de la API y capturarlas en el Frontend usando interceptores o manejadores de TanStack Query para mostrar *toasts* informativos al usuario.

## 5. Mejora en la Información y Base de Datos (RAG)
**Objetivo:** El agente debe recibir mejor contexto y metadatos de lo que lee.

- **Paso 1: Enriquecimiento de Metadatos:** Al procesar un PDF/Excel/DXF, no solo extraer el texto, sino guardar en Qdrant metadatos como: `autor`, `fecha_creacion`, `tipo_documento` (plano, presupuesto, memoria), y `obra_id`.
- **Paso 2: Pre-procesamiento Inteligente:** Mejorar el `file-processor`. Si es un Excel, formatearlo como tabla Markdown antes de vectorizarlo. Si es un plano DXF, extraer capas y cotas de forma estructurada.
- **Paso 3: Búsqueda Híbrida:** Configurar Qdrant para usar no solo búsqueda por similitud semántica (embeddings), sino combinarla con búsqueda por palabras clave exactas (BM25) para términos técnicos muy específicos de ingeniería.

## 6. Mejora de Interfaz y System Prompt
**Objetivo:** Hacer la subida de archivos intuitiva y profesional, y darle al agente reglas estrictas de comportamiento.

- **Paso 1: UI de Subida (Estética):**
  - Rediseñar el componente de subida en `src/components/chat/` o `documents/`.
  - Usar un área de *Drag & Drop* de Shadcn con animaciones de Framer Motion.
  - Mostrar barras de progreso reales durante la extracción de texto y el guardado en Qdrant.
- **Paso 2: Refinamiento del System Prompt:**
  - Actualizar el archivo `src/lib/ai/` (donde esté el prompt base).
  - Añadir directivas estrictas: "Siempre cita el documento y la página de donde sacaste la información usando los metadatos proporcionados".
  - Darle al agente un tono de "Auditor Técnico Senior": preciso, conciso y basado en normas.
