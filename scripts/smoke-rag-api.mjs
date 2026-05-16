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

// 首次查询状态会懒创建 rag_documents.pending，避免创建文档流程强耦合索引表。
const initialStatus = await request(`/api/v1/rag/documents/${document.id}/status`, { token });
assert(initialStatus.isInKnowledgeBase === true, "initial RAG status should be enabled");
assert(initialStatus.status === "pending", `initial RAG status should be pending, got ${initialStatus.status}`);
console.log("initial rag status ok");

// 关闭知识库只验证状态流转。真实 Qdrant point 删除会在 M5.2 接入正式索引后补齐。
const disabled = await request(`/api/v1/rag/documents/${document.id}/index`, {
  method: "DELETE",
  token,
});
assert(disabled.isInKnowledgeBase === false, "disabled RAG status should leave knowledge base");
assert(disabled.status === "disabled", `disabled RAG status should be disabled, got ${disabled.status}`);
console.log("disable knowledge base ok");

const disabledStatus = await request(`/api/v1/rag/documents/${document.id}/status`, { token });
assert(disabledStatus.isInKnowledgeBase === false, "status after disable should stay disabled");
assert(disabledStatus.status === "disabled", `status after disable should be disabled, got ${disabledStatus.status}`);
console.log("disabled status ok");

// 重新开启后回到 pending，后续 worker 或同步索引流程会消费这个状态。
const enabled = await request(`/api/v1/rag/documents/${document.id}/index`, {
  method: "POST",
  token,
});
assert(enabled.isInKnowledgeBase === true, "enabled RAG status should enter knowledge base");
assert(enabled.status === "pending", `enabled RAG status should be pending, got ${enabled.status}`);
console.log("enable knowledge base ok");

await request(`/api/v1/documents/${document.id}`, { method: "DELETE", token });
console.log("cleanup document ok");

console.log("rag smoke test passed");
