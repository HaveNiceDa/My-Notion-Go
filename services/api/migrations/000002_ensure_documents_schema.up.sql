-- 这份迁移用于兼容已经执行过早期 000001_initial_schema 的本地数据库。
-- 如果 000001 已经包含 documents / document_contents，这里会保持幂等不重复创建对象。
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id UUID NULL REFERENCES documents(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '',
  cover_image TEXT NOT NULL DEFAULT '',
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  is_starred BOOLEAN NOT NULL DEFAULT FALSE,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  is_in_knowledge_base BOOLEAN NOT NULL DEFAULT FALSE,
  position DOUBLE PRECISION NOT NULL DEFAULT 0,
  path TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_user_parent_position ON documents (user_id, parent_id, position);
CREATE INDEX IF NOT EXISTS idx_documents_user_archived ON documents (user_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_documents_user_starred ON documents (user_id, is_starred);
CREATE INDEX IF NOT EXISTS idx_documents_path ON documents (path);
CREATE INDEX IF NOT EXISTS idx_documents_deleted_at ON documents (deleted_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_documents_set_updated_at'
  ) THEN
    CREATE TRIGGER trg_documents_set_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS document_contents (
  document_id UUID PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  content JSONB NOT NULL DEFAULT '[]'::jsonb,
  content_hash TEXT NOT NULL DEFAULT '',
  version BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_contents_content_gin ON document_contents USING GIN (content);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_document_contents_set_updated_at'
  ) THEN
    CREATE TRIGGER trg_document_contents_set_updated_at
    BEFORE UPDATE ON document_contents
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;
