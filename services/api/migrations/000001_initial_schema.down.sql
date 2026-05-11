-- down migration 用于回滚 000001_initial_schema.up.sql 创建的对象。
-- 删除顺序必须先删依赖方，再删被依赖方：
-- document_contents -> documents -> refresh_tokens -> users。
DROP TABLE IF EXISTS document_contents;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS users;

-- 表删除后，再删除共用触发器函数和 UUID 扩展。
DROP FUNCTION IF EXISTS set_updated_at();
DROP EXTENSION IF EXISTS pgcrypto;
