# Auditoria para demo autofuncional - 2026-06-12

## Estado verificado

- Persistencia principal: PostgreSQL local en Docker (`DATABASE_URL`) con `pgvector`.
- Auth: local, sobre `auth.users`, JWT HS256 y refresh tokens rotativos.
- Storage: filesystem local en `STORAGE_DIR` (`./data/storage` por defecto).
- La capa `src/lib/insforge/*` quedo como nombre historico: reexporta el cliente propio de Postgres/auth/storage.
- Base local limpiada para demo: usuarios, organizaciones, proyectos, archivos, sesiones, chunks y runs quedaron en cero; se preservo `schema_migrations`.
- Verificaciones ejecutadas: `npm run migrate:dry`, `npm run lint`, `npm run type-check`, `npm test`, `npm run build`.

## Faltantes criticos antes de presentar

1. Rotar secretos locales antes de compartir pantalla o deployar.
   - `SUPER_ADMIN_KEY` actual es debil para produccion.
   - `.env.local` contiene claves reales de DeepSeek, NVIDIA, Resend y variables legacy de InsForge/Qdrant.

2. Preparar seed/demo controlado.
   - Crear un script o boton seguro que cargue empresa demo, fundador, proyecto, archivos y datos operativos.
   - Debe poder resetearse sin tocar `schema_migrations`.
   - Debe evitar depender de datos manuales creados desde super-admin.

3. Definir modo offline/degradado.
   - Chat depende de DeepSeek.
   - Embeddings dependen de NVIDIA NIM; sin key degrada a busqueda textual.
   - Email depende de Resend, aunque algunas rutas ya hacen dry-run si falta key.
   - Si la demo debe ser 100% sin terceros, falta mock/local mode para IA, embeddings y emails.

4. Limpiar configuracion legacy.
   - Quitar o separar variables `NEXT_PUBLIC_INSFORGE_URL`, `INSFORGE_SERVICE_ROLE_KEY`, `QDRANT_URL` y `QDRANT_API_KEY` de `.env.local` si ya no se usan.
   - Aclarar en README que `insforge` en paths de codigo es compatibilidad historica.

5. Resolver warnings de build.
   - `npm run build` compila, pero Turbopack avisa que el adapter filesystem puede estar trazando demasiado por `path.resolve`/filesystem.
   - No bloquea demo local, pero conviene corregir antes de empaquetado o deploy.

6. Completar assets basicos.
   - El navegador pide `apple-touch-icon.png` y `apple-touch-icon-precomposed.png`; hoy dev server responde 404.

7. Mejorar UX de invitaciones.
   - El registro de fundador requiere link completo con token.
   - Ya se ajusto la verificacion para rechazar links incompletos o con token incorrecto antes de mostrar el formulario final.
   - Falta mostrar una accion clara en UI: volver a solicitar link / contactar admin.

## Riesgos no bloqueantes

- El working tree tiene muchos cambios previos en documentacion y UI; revisar antes de commit.
- Los tests de integracion real contra Postgres estan marcados como skipped en la suite actual.
- El endpoint `/api/seed-demo` existe en desarrollo, pero hoy depende de credenciales de un usuario existente y no reemplaza un seed autocontenido.

## Flujo recomendado para una demo limpia

1. Iniciar Docker/Postgres.
2. Correr migraciones.
3. Resetear datos de demo.
4. Ejecutar seed controlado.
5. Abrir `/login` y `/super-admin`.
6. Entrar a super-admin con la clave local.
7. Usar un usuario demo ya creado por seed o copiar el link completo de invitacion con token.
