-- documents 表上的字段是产品开关：true 表示这篇文档应该参与知识库。
-- 真正的索引进度不放在 documents 上，而是交给 rag_documents.status 管理。
ALTER TABLE documents ALTER COLUMN is_in_knowledge_base SET DEFAULT TRUE;

-- M5 开始采用“文档默认进入知识库”的产品规则。
-- 当前还没有正式的关闭入口，因此历史文档统一迁移为开启状态。
UPDATE documents
SET is_in_knowledge_base = TRUE
WHERE deleted_at IS NULL;

-- rag_documents 是“每篇文档一条”的索引状态表。
-- 它把产品开关和索引执行进度解耦：文档可以默认开启知识库，但索引仍可能处于 pending/failed。
CREATE TABLE IF NOT EXISTS rag_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  content_hash TEXT NOT NULL DEFAULT '',
  chunk_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NOT NULL DEFAULT '',
  indexed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rag_documents_user_document_unique UNIQUE (user_id, document_id),
  CONSTRAINT rag_documents_status_check CHECK (status IN ('pending', 'indexing', 'indexed', 'failed', 'disabled'))
);

-- 按 user_id + status 查询用于后续 worker 扫描 pending/failed 文档；按 document_id 查询用于详情页状态展示。
CREATE INDEX IF NOT EXISTS idx_rag_documents_user_status ON rag_documents (user_id, status);
CREATE INDEX IF NOT EXISTS idx_rag_documents_document_id ON rag_documents (document_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_rag_documents_set_updated_at'
  ) THEN
    CREATE TRIGGER trg_rag_documents_set_updated_at
    BEFORE UPDATE ON rag_documents
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;

-- rag_chunks 保存切块后的文本和向量库 point id。
-- 向量本体不放 PostgreSQL，避免数据库膨胀；这里保留 metadata 和 qdrant_point_id 用于回溯与删除。
CREATE TABLE IF NOT EXISTS rag_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  rag_document_id UUID NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
  qdrant_point_id TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  block_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  position INTEGER NOT NULL DEFAULT 0,
  token_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_rag_document_position ON rag_chunks (rag_document_id, position);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_document_id ON rag_chunks (document_id);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_qdrant_point_id ON rag_chunks (qdrant_point_id);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_metadata_gin ON rag_chunks USING GIN (metadata);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_rag_chunks_set_updated_at'
  ) THEN
    CREATE TRIGGER trg_rag_chunks_set_updated_at
    BEFORE UPDATE ON rag_chunks
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;

-- jobs 是后续异步 worker 的通用任务表。
-- M5.1 先建表但不强依赖 RabbitMQ；后面可以先用 DB polling，再平滑切到消息队列。
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_error TEXT NOT NULL DEFAULT '',
  finished_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT jobs_status_check CHECK (status IN ('pending', 'running', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_jobs_user_status ON jobs (user_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_type_status ON jobs (type, status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs (created_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_jobs_set_updated_at'
  ) THEN
    CREATE TRIGGER trg_jobs_set_updated_at
    BEFORE UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;
