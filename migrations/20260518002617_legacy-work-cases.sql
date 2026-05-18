-- =============================================================
-- Migracion legacy de chat_sessions hacia work_cases.
-- Backward-compatible e idempotente: solo procesa sesiones con project_id
-- y work_case_id NULL. Mantiene chat_sessions como canal de conversación.
-- =============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

WITH legacy_sessions AS (
  SELECT
    cs.id,
    cs.organization_id,
    cs.project_id,
    cs.user_id,
    cs.title,
    cs.file_type,
    cs.started_at,
    cs.created_at
  FROM chat_sessions cs
  WHERE cs.deleted_at IS NULL
    AND cs.project_id IS NOT NULL
    AND cs.work_case_id IS NULL
),
inserted_cases AS (
  INSERT INTO work_cases (
    id,
    organization_id,
    project_id,
    kind,
    status,
    title,
    owner_user_id,
    created_by,
    metadata,
    created_at,
    updated_at
  )
  SELECT
    gen_random_uuid(),
    ls.organization_id,
    ls.project_id,
    'legacy_conversation',
    'open',
    COALESCE(NULLIF(ls.title, ''), 'Conversación legacy'),
    CASE
      WHEN ls.user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN ls.user_id::uuid
      ELSE NULL
    END,
    CASE
      WHEN ls.user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN ls.user_id::uuid
      ELSE NULL
    END,
    jsonb_build_object(
      'source', 'legacy_chat_session',
      'chatSessionId', ls.id,
      'startedAt', ls.started_at,
      'fileType', ls.file_type
    ),
    COALESCE(ls.created_at, NOW()),
    NOW()
  FROM legacy_sessions ls
  RETURNING
    id,
    organization_id,
    project_id,
    owner_user_id,
    title,
    metadata
),
linked_sessions AS (
  UPDATE chat_sessions cs
  SET work_case_id = ic.id
  FROM inserted_cases ic
  WHERE cs.id = ic.metadata->>'chatSessionId'
    AND cs.organization_id = ic.organization_id
  RETURNING
    cs.id AS chat_session_id,
    cs.title AS chat_session_title,
    cs.file_type,
    ic.id AS work_case_id,
    ic.organization_id,
    ic.project_id,
    ic.owner_user_id
),
session_events AS (
  INSERT INTO work_case_events (
    organization_id,
    work_case_id,
    project_id,
    actor_user_id,
    event_type,
    summary,
    payload
  )
  SELECT
    ls.organization_id,
    ls.work_case_id,
    ls.project_id,
    ls.owner_user_id,
    'chat_session.legacy_linked',
    ls.chat_session_title,
    jsonb_build_object(
      'chatSessionId', ls.chat_session_id,
      'fileType', ls.file_type
    )
  FROM linked_sessions ls
  RETURNING id
),
message_evidence AS (
  INSERT INTO work_case_evidence (
    organization_id,
    work_case_id,
    project_id,
    evidence_type,
    entity_type,
    entity_id,
    label,
    metadata
  )
  SELECT
    ls.organization_id,
    ls.work_case_id,
    ls.project_id,
    'message',
    'chat_session',
    NULL,
    ls.chat_session_title,
    jsonb_build_object(
      'chatSessionId', ls.chat_session_id,
      'snapshotUpdatedAt', snap.updated_at,
      'messageCount', COALESCE(jsonb_array_length(snap.messages), 0)
    )
  FROM linked_sessions ls
  LEFT JOIN chat_snapshots snap ON snap.session_id = ls.chat_session_id
  RETURNING id
)
INSERT INTO work_case_evidence (
  organization_id,
  work_case_id,
  project_id,
  evidence_type,
  entity_type,
  entity_id,
  label,
  metadata
)
SELECT DISTINCT
  ls.organization_id,
  ls.work_case_id,
  ls.project_id,
  'file',
  'uploaded_files',
  uf.id,
  uf.file_name,
  jsonb_build_object(
    'source', 'legacy_chat_session_file_meta',
    'chatSessionId', ls.chat_session_id
  )
FROM linked_sessions ls
JOIN chat_snapshots snap ON snap.session_id = ls.chat_session_id
JOIN uploaded_files uf
  ON uf.organization_id = ls.organization_id
  AND uf.project_id = ls.project_id
  AND uf.deleted_at IS NULL
  AND (
    snap.messages::text ILIKE '%' || uf.id::text || '%'
    OR snap.messages::text ILIKE '%' || uf.file_name || '%'
  )
ON CONFLICT DO NOTHING;
