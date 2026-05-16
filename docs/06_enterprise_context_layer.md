# Capa de Contexto Empresarial

> Evolución de "Base Documental" hacia una lectura segura del conocimiento completo de la constructora.

## 1. Cambio de concepto

La Base Documental no debe pensarse como una carpeta de archivos subidos al chat. Eso sirve para el MVP, pero no alcanza para lanzar EdificIA como sistema empresarial.

El objetivo real es construir una **Capa de Contexto Empresarial**: una capa segura, de solo lectura por defecto, capaz de conectarse a los sistemas existentes de una constructora, entender cómo trabaja la empresa y convertir datos dispersos en contexto operativo auditable.

En términos de producto, EdificIA no "guarda documentos". EdificIA **comprende la empresa constructora**.

## 2. Qué debe poder conectar

La primera versión debe admitir ingesta manual, pero la arquitectura debe prepararse para conectores:

- Drives corporativos: Google Drive, OneDrive, SharePoint, Dropbox.
- Sistemas internos: ERPs, CRMs, sistemas contables, compras, certificaciones y proveedores.
- Bases SQL o exports periódicos: PostgreSQL, MySQL, SQL Server, CSV/SFTP.
- Herramientas de obra: cronogramas, partes diarios, órdenes de compra, remitos, subcontratos, HSE.
- Email y comunicaciones, solo si el cliente lo autoriza explícitamente.

Regla de lanzamiento: empezar con conectores acotados y de bajo riesgo, no con acceso amplio indiscriminado.

## 3. Principios de seguridad

La confianza de una constructora se gana por diseño, no por promesa comercial.

- **Solo lectura por defecto**. EdificIA no modifica sistemas externos sin autorización explícita.
- **Permisos mínimos**. Cada conector debe pedir el menor scope posible.
- **Sin credenciales persistidas en claro**. Secrets cifrados y rotables.
- **Auditoría de acceso**. Cada sincronización debe registrar qué se leyó, cuándo, desde qué conector y con qué resultado.
- **Revocación simple**. El admin debe poder desconectar una fuente sin soporte técnico.
- **Tenant isolation absoluto**. Todo dato sincronizado conserva `organization_id`.
- **Clasificación de sensibilidad**. PII, datos financieros, contratos y documentación legal deben marcarse y tratarse distinto.

## 4. Qué contexto debe extraer

La capa no solo indexa texto. Debe construir una lectura estructurada de la empresa:

- Obras activas, pausadas y finalizadas.
- Relación entre obra, cliente, ubicación, equipo interno, subcontratistas y proveedores.
- Tipos documentales reales de la empresa: presupuestos, certificados, planos, remitos, órdenes de compra, contratos, ART/EPP, actas, partes diarios.
- Estado de completitud por obra y fase.
- Historial de decisiones, versiones y contradicciones.
- Patrones internos: estructura de presupuestos, rubros frecuentes, criterios de redondeo, proveedores habituales, desvíos típicos.
- Riesgos: documentos faltantes, vencimientos, inconsistencias, presupuestos fuera de patrón, obras sin trazabilidad.

## 5. Modelo mental del producto

EdificIA debe poder responder preguntas en tres niveles:

1. **Documento**: "Auditá este presupuesto."
2. **Obra**: "Qué falta para cerrar el legajo de Torre Norte?"
3. **Empresa**: "Qué obras tienen mayor riesgo documental o financiero este mes?"

El tercer nivel es el diferencial del lanzamiento. Permite auditar una constructora completa, no solo un archivo.

## 6. Arquitectura propuesta

### 6.1 Conectores

Cada fuente externa debe representarse como un conector con:

- `connector_id`
- `organization_id`
- tipo de fuente
- estado de autorización
- scopes concedidos
- cursor de sincronización
- último resultado
- errores recientes

### 6.2 Inventario empresarial

Antes de vectorizar, EdificIA debe construir inventario:

- archivos encontrados
- tablas o entidades disponibles
- metadatos
- owners
- fechas
- rutas
- permisos
- vínculo probable con obra

Este inventario es auditable y permite explicar de dónde salió cada dato.

### 6.3 Normalización

Los datos externos deben mapearse a entidades internas:

- `enterprise_sources`
- `enterprise_documents`
- `enterprise_entities`
- `enterprise_relations`
- `enterprise_sync_runs`
- `projects`
- `uploaded_files` o su reemplazo futuro
- `document_chunks`

### 6.4 Grafo empresa-obra-documento

El RAG actual debe evolucionar hacia un grafo:

- documento pertenece a obra
- documento contradice documento
- presupuesto deriva de versión anterior
- certificado corresponde a avance
- ART/EPP pertenece a subcontratista
- proveedor participa en obra
- remito respalda compra

El grafo permite preguntas que una búsqueda semántica sola no resuelve.

## 7. UX de lanzamiento

La UI no debería decir solo "Base Documental". Nombres más cercanos al valor real:

- **Contexto de Empresa**
- **Fuentes de Datos**
- **Mapa de Obras**
- **Inteligencia Documental**
- **Conectores**

Propuesta: mantener "Base Documental" para la vista de archivos, pero crear una sección superior llamada **Contexto de Empresa** que muestre:

- fuentes conectadas
- estado de sincronización
- obras detectadas
- documentos clasificados
- alertas de riesgo
- cobertura por obra

## 8. Roadmap por etapas

### Etapa 1: Base actual mejorada

- Renombrar conceptualmente la sección a "Contexto de Empresa".
- Mantener subida manual de archivos.
- Mejorar clasificación documental.
- Detectar obra asociada automáticamente.

### Etapa 2: Conectores seguros

- Google Drive / SharePoint en solo lectura.
- Inventario de archivos antes de ingestarlos.
- Selección explícita de carpetas permitidas.
- Sync incremental.

### Etapa 3: Extracción empresarial

- Detección de obras activas.
- Mapa obra-documentos-proveedores.
- Cobertura documental automática.
- Riesgos por obra.

### Etapa 4: Auditoría transversal

- Preguntas y reportes a nivel empresa.
- Ranking de obras con mayor riesgo.
- Contradicciones entre fuentes.
- Patrones financieros/documentales por constructora.

## 9. Regla de producto

EdificIA no debe posicionarse como un repositorio de archivos.

Debe posicionarse como una **capa de inteligencia y auditoría sobre la información real de la constructora**, con seguridad suficiente para conectarse a sistemas existentes sin poner en riesgo la operación del cliente.
