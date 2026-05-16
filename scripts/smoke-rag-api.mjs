const baseUrl = process.env.API_BASE_URL ?? "http://localhost:8080";
const email = process.env.SMOKE_EMAIL ?? "demo@example.com";
const password = process.env.SMOKE_PASSWORD ?? "password123";
const deviceName = "rag-smoke-test";

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success === false) {
    throw new Error(`${options.method ?? "GET"} ${path} failed: ${response.status} ${JSON.stringify(body)}`);
  }
  return body?.data;
}

async function loginOrRegister() {
  try {
    return await request("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, deviceName }),
    });
  } catch {
    return request("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name: "Smoke Tester" }),
    });
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const auth = await loginOrRegister();
const token = auth.tokens.accessToken;
console.log(`authenticated as ${auth.user.email}`);

const document = await request("/api/v1/documents", {
  method: "POST",
  token,
  body: JSON.stringify({ title: `RAG Smoke ${new Date().toISOString()}` }),
});
// M5.1 的产品规则是“默认进入知识库”，所以创建文档后先验证 documents 表开关。
assert(document.isInKnowledgeBase === true, "new document should be in knowledge base by default");
console.log(`created knowledge-base document ${document.id}`);

const content = [
  {
    id: "rag-smoke-block-1",
    type: "paragraph",
    props: {
      textColor: "default",
      backgroundColor: "default",
      textAlignment: "left",
    },
    content: [
      {
        type: "text",
        text: "RAG smoke content for DashScope embedding and Qdrant upsert.",
        styles: {},
      },
    ],
    children: [],
  },
];
await request(`/api/v1/documents/${document.id}/content`, {
  method: "PUT",
  token,
  body: JSON.stringify({ content }),
});
console.log("write content ok");

// 首次查询状态会懒创建 rag_documents.pending，避免创建文档流程强耦合索引表。
const initialStatus = await request(`/api/v1/rag/documents/${document.id}/status`, { token });
assert(initialStatus.isInKnowledgeBase === true, "initial RAG status should be enabled");
assert(initialStatus.status === "pending", `initial RAG status should be pending, got ${initialStatus.status}`);
console.log("initial rag status ok");

const indexed = await request(`/api/v1/rag/documents/${document.id}/index`, {
  method: "POST",
  token,
});
assert(indexed.isInKnowledgeBase === true, "indexed RAG status should stay in knowledge base");
assert(indexed.status === "indexed", `indexed RAG status should be indexed, got ${indexed.status}`);
assert(indexed.chunkCount > 0, "indexed RAG status should include chunks");
console.log(`index ok, chunks=${indexed.chunkCount}`);

// 关闭知识库会同步清理 rag_chunks 和 Qdrant points，避免后续检索命中已排除文档。
const disabled = await request(`/api/v1/rag/documents/${document.id}/index`, {
  method: "DELETE",
  token,
});
assert(disabled.isInKnowledgeBase === false, "disabled RAG status should leave knowledge base");
assert(disabled.status === "disabled", `disabled RAG status should be disabled, got ${disabled.status}`);
assert(disabled.chunkCount === 0, `disabled RAG status should clear chunks, got ${disabled.chunkCount}`);
console.log("disable knowledge base ok");

const disabledStatus = await request(`/api/v1/rag/documents/${document.id}/status`, { token });
assert(disabledStatus.isInKnowledgeBase === false, "status after disable should stay disabled");
assert(disabledStatus.status === "disabled", `status after disable should be disabled, got ${disabledStatus.status}`);
console.log("disabled status ok");

// 重新开启会再次执行同步索引；后续如切 worker，只需要保持最终状态语义一致。
const enabled = await request(`/api/v1/rag/documents/${document.id}/index`, {
  method: "POST",
  token,
});
assert(enabled.isInKnowledgeBase === true, "enabled RAG status should enter knowledge base");
assert(enabled.status === "indexed", `enabled RAG status should be indexed, got ${enabled.status}`);
assert(enabled.chunkCount > 0, "re-enabled RAG status should rebuild chunks");
console.log("re-enable and re-index knowledge base ok");

await request(`/api/v1/documents/${document.id}`, { method: "DELETE", token });
console.log("cleanup document ok");

console.log("rag smoke test passed");
