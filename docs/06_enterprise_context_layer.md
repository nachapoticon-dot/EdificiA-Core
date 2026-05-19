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
- Archivos subidos al agente durante conversaciones: deben entrar al mismo inventario empresarial, con trazabilidad de sesión/expediente, no quedar como adjuntos aislados.

Regla de lanzamiento: empezar con conectores acotados y de bajo riesgo, no con acceso amplio indiscriminado.

## 2.1 Formas reales de presentación de datos

La empresa no va a entregar siempre "documentos". EdificIA debe estar preparada para encontrar información en formatos heterogéneos y decidir si están listos para lectura, si requieren normalización o si solo sirven como referencia parcial.

Fuentes esperadas:

- Carpetas con PDFs, Excels, Word, DWG/DXF, imágenes, ZIPs y versiones duplicadas.
- Exports de sistemas en CSV/XLSX con nombres de columnas propios de la empresa.
- Tablas SQL o vistas de ERP/contabilidad/compras/certificaciones.
- Backups o dumps parciales provistos por el cliente.
- Listas de precios de proveedores, catálogos, remitos, órdenes de compra y presupuestos no estandarizados.
- Datos cargados manualmente durante una conversación con el agente.

Cada fuente debe pasar por un estado de preparación:

- `descubierta`: existe en una fuente conectada, todavía no se leyó.
- `inventariada`: se conocen metadatos, ubicación, tamaño, owner, fechas y permisos.
- `clasificada`: se estimó tipo documental/entidad y vínculo probable con obra/empresa.
- `normalizada`: se mapearon campos relevantes a entidades internas cuando aplica.
- `indexada`: está disponible para búsqueda semántica y contextual.
- `operativa`: puede alimentar agente, reportes, perfiles, riesgos o expedientes.
- `observada`: requiere revisión humana por ambigüedad, permisos, PII, corrupción o baja confianza.

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

Además debe construir un **perfil empresarial vivo** por organización:

- Cómo nombra obras, rubros, proveedores, centros de costo y versiones.
- Qué formatos usa para presupuestos, compras, certificados, HSE y partes diarios.
- Qué fuentes son más confiables para cada tipo de dato.
- Qué proveedores/subcontratistas aparecen con frecuencia y en qué rubros.
- Qué obras están activas aunque no hayan sido cargadas manualmente.
- Qué campos y convenciones internas deben recordarse para futuras auditorías.

Este perfil no reemplaza la base de datos transaccional: es una lectura auditada de cómo opera la empresa, con evidencia y confianza por inferencia.

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

### 6.2 Catálogo de fuentes empresariales

Antes de vectorizar, EdificIA debe construir un catálogo auditable:

- archivos encontrados
- tablas o entidades disponibles
- metadatos
- owners
- fechas
- rutas
- permisos
- vínculo probable con obra

Este catálogo permite explicar de dónde salió cada dato.

El catálogo debe incluir tanto fuentes conectadas como archivos subidos por chat. Un archivo subido al agente debe poder:

- vincularse a `organization_id`, `project_id` y `work_case_id` cuando existan;
- enriquecer el perfil de empresa si aporta patrones o entidades nuevas;
- quedar disponible para la lupa contextual;
- generar evidencia para expedientes y futuros reportes;
- mantener su origen conversacional para trazabilidad.

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

### 6.5 Radar de Evidencia

La búsqueda de EdificIA debe evolucionar a un **Radar de Evidencia** empresarial: una entrada única para detectar señales, relaciones y riesgos dentro de la constructora.

Debe buscar por:

- nombre de archivo, carpeta, tabla o fuente;
- texto y embeddings;
- entidad detectada (obra, proveedor, subcontratista, rubro, trabajador, contrato, remito);
- contexto operativo ("la lista de precios de sanitarios que usamos en Rosario", "el contrato que reemplazó al anterior", "ART vencidas de subcontratistas");
- relaciones del grafo;
- evidencia vinculada a expedientes.

La respuesta de la lupa no debe ser solo una lista de documentos. Debe devolver resultados agrupados por intención:

- documentos o tablas relevantes;
- entidades encontradas;
- obras relacionadas;
- expedientes/evidencias asociados;
- nivel de confianza;
- por qué apareció cada resultado.

La búsqueda debe respetar `organization_id`, permisos por fuente y sensibilidad de datos.

## 7. UX de lanzamiento

La UI no debería decir "Base Documental" como sección principal. El nombre de navegación vigente es **Inteligencia Empresarial**. Sus modos internos son:

- **Radar** — lectura cruzada de evidencia, obras, expedientes y relaciones.
- **Fuentes** — ingreso, preparación y estado de lectura de archivos, exports, carpetas y conectores.
- **Mapa Vivo** — entidades, patrones, cobertura y riesgo por obra.

Decisión vigente 2026-05-19: **Base Documental queda integrada dentro de Inteligencia Empresarial**. No debe aparecer como un bloque de navegación paralelo ni como producto separado. La vista de carga y preparación de datos es la pestaña **Fuentes** dentro de `/dashboard/contexto`, junto con **Radar** y **Mapa Vivo**.

La sección **Inteligencia Empresarial** debe mostrar:

- fuentes conectadas
- estado de sincronización
- obras detectadas
- documentos clasificados
- alertas de riesgo
- cobertura por obra

## 8. Roadmap por etapas

### Etapa 1: Base actual integrada

- Renombrar conceptualmente la sección a "Inteligencia Empresarial".
- Mantener subida manual de archivos.
- Integrar fuentes empresariales, radar y mapa vivo en una sola navegación de Inteligencia Empresarial.
- Mejorar clasificación documental.
- Detectar obra asociada automáticamente.
- Agregar al inventario los archivos subidos al agente y vincularlos con expedientes.
- Crear un primer radar semántico sobre documentos, reportes y evidencia.

### Etapa 2: Conectores seguros

- Google Drive / SharePoint en solo lectura.
- Catálogo de archivos antes de ingestarlos.
- Selección explícita de carpetas permitidas.
- Sync incremental.
- Estados de preparación (`descubierta` → `operativa`/`observada`) visibles para admins.

### Etapa 3: Extracción empresarial

- Detección de obras activas. _(parcial 2026-05-19: las obras se leen desde `projects` y entran al perfil; falta detección automática desde fuentes externas)._
- Mapa obra-documentos-proveedores. _(parcial 2026-05-19: cobertura por obra y entidades top en `/dashboard/contexto/perfil`; falta vista de mapa visual)._
- Cobertura documental automática. _(✅ 2026-05-19 — `enterprise_project_coverage` recalculable vía `POST /api/enterprise-context/profile/refresh`)._
- Riesgos por obra. _(✅ 2026-05-19 — `risk_level` en `enterprise_project_coverage` se deriva de `findings_open` + ratio de documentos `observada`)._
- Perfil vivo por empresa con patrones de nombres, rubros, proveedores y formatos. _(✅ 2026-05-19 — `enterprise_entities` + `enterprise_patterns` + `enterprise_profile_snapshots`; ver "Pipeline del perfil" en `docs/04_architecture_map.md`)._
- Memoria activa confirmada por usuario para preferencias y criterios empresariales reutilizables. _(✅ 2026-05-19 — tool `recordar_aprendizaje` escribe `company_learned_patterns.document_type='agent_memory'` con evidencia y audit log)._
- Normalización de exports CSV/XLSX/SQL hacia entidades internas. _(pendiente; depende de Etapa 2 — conectores reales)._

### Etapa 4: Auditoría transversal

- Preguntas y reportes a nivel empresa.
- Ranking de obras con mayor riesgo.
- Contradicciones entre fuentes.
- Patrones financieros/documentales por constructora.
- Radar de Evidencia a nivel empresa con búsqueda por contexto, entidad, evidencia y relaciones.

## 9. Regla de producto

EdificIA no debe posicionarse como un repositorio de archivos.

Debe posicionarse como una **capa de inteligencia y auditoría sobre la información real de la constructora**, con seguridad suficiente para conectarse a sistemas existentes sin poner en riesgo la operación del cliente.
