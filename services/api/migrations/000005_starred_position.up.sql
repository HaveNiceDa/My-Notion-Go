ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS starred_position DOUBLE PRECISION NULL;

CREATE INDEX IF NOT EXISTS idx_documents_user_starred_position
  ON documents (user_id, is_starred, starred_position)
  WHERE deleted_at IS NULL;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY updated_at DESC, created_at DESC
    ) AS position
  FROM documents
  WHERE is_starred = TRUE
    AND is_archived = FALSE
    AND deleted_at IS NULL
)
UPDATE documents
SET starred_position = ranked.position
FROM ranked
WHERE documents.id = ranked.id
  AND documents.starred_position IS NULL;
