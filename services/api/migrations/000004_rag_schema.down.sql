DROP TRIGGER IF EXISTS trg_jobs_set_updated_at ON jobs;
DROP TABLE IF EXISTS jobs;

DROP TRIGGER IF EXISTS trg_rag_chunks_set_updated_at ON rag_chunks;
DROP TABLE IF EXISTS rag_chunks;

DROP TRIGGER IF EXISTS trg_rag_documents_set_updated_at ON rag_documents;
DROP TABLE IF EXISTS rag_documents;

ALTER TABLE documents ALTER COLUMN is_in_knowledge_base SET DEFAULT FALSE;
