ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS public_id UUID;

UPDATE documents
SET public_id = gen_random_uuid()
WHERE public_id IS NULL;

ALTER TABLE documents
  ALTER COLUMN public_id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN public_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_public_id
  ON documents (public_id);

CREATE INDEX IF NOT EXISTS idx_documents_public_lookup
  ON documents (public_id, is_published)
  WHERE deleted_at IS NULL;
