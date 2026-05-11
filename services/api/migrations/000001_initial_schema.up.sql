-- pgcrypto 提供 gen_random_uuid()，让 PostgreSQL 可以直接生成 UUID 主键。
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 所有包含 updated_at 的表共用这个触发器函数。
-- 业务代码只需要 UPDATE 数据，数据库会自动刷新 updated_at。
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 用户表：保存登录账号和用户基础资料。
-- password_hash 只保存哈希后的密码，永远不保存明文密码。
-- deleted_at 预留软删除能力，后续可以不物理删除用户。
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  avatar_url TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT users_email_unique UNIQUE (email)
);

-- deleted_at 索引用于后续按“未删除用户”过滤。
CREATE INDEX idx_users_deleted_at ON users (deleted_at);

CREATE TRIGGER trg_users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Refresh Token 表：用于登录态续期和退出登录。
-- Access Token 通常较短期，Refresh Token 可用于换取新的 Access Token。
-- token_hash 只保存 token 的哈希值，避免数据库泄露时直接暴露可用 token。
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  device_name TEXT NOT NULL DEFAULT '',
  ip_address TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT refresh_tokens_token_hash_unique UNIQUE (token_hash)
);

-- 按用户查设备/会话、清理过期 token、过滤已吊销 token 都是高频场景。
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens (expires_at);
CREATE INDEX idx_refresh_tokens_revoked_at ON refresh_tokens (revoked_at);

CREATE TRIGGER trg_refresh_tokens_set_updated_at
BEFORE UPDATE ON refresh_tokens
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- 文档元信息表：保存文档树、标题、图标、封面、状态和排序信息。
-- 正文不放在这里，避免加载侧边栏文档树时把大块 JSON 内容一起查出来。
-- parent_id 指向 documents.id，用来表示父子文档关系。
-- path 预留给后续快速查询子树或面包屑路径。
CREATE TABLE documents (
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

-- 文档树查询通常按 user_id + parent_id 分组，再按 position 排序。
CREATE INDEX idx_documents_user_parent_position ON documents (user_id, parent_id, position);
-- 回收站、收藏列表、路径查询和软删除过滤分别使用这些索引。
CREATE INDEX idx_documents_user_archived ON documents (user_id, is_archived);
CREATE INDEX idx_documents_user_starred ON documents (user_id, is_starred);
CREATE INDEX idx_documents_path ON documents (path);
CREATE INDEX idx_documents_deleted_at ON documents (deleted_at);

CREATE TRIGGER trg_documents_set_updated_at
BEFORE UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- 文档正文表：保存编辑器产生的 block JSON。
-- document_id 同时是主键和外键，表示一个文档只有一份当前正文。
-- content_hash 和 version 预留给自动保存、冲突检测、历史版本和 RAG 增量索引。
CREATE TABLE document_contents (
  document_id UUID PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  content JSONB NOT NULL DEFAULT '[]'::jsonb,
  content_hash TEXT NOT NULL DEFAULT '',
  version BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- GIN 索引用于 JSONB 内容查询。第一版不一定马上用到，但适合后续做内容搜索或调试。
CREATE INDEX idx_document_contents_content_gin ON document_contents USING GIN (content);

CREATE TRIGGER trg_document_contents_set_updated_at
BEFORE UPDATE ON document_contents
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
