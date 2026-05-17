DROP INDEX IF EXISTS idx_documents_public_lookup;
DROP INDEX IF EXISTS idx_documents_public_id;

ALTER TABLE documents
  DROP COLUMN IF EXISTS public_id;
