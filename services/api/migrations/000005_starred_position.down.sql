DROP INDEX IF EXISTS idx_documents_user_starred_position;

ALTER TABLE documents
  DROP COLUMN IF EXISTS starred_position;
