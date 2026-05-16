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

async function streamRAGChat(token, payload) {
  const response = await fetch(`${baseUrl}/api/v1/rag/chat/stream`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok || !response.body) {
    const body = await response.text().catch(() => "");
    throw new Error(`POST /api/v1/rag/chat/stream failed: ${response.status} ${body}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const events = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const event = parseSSEChunk(chunk);
      if (event) {
        events.push(event);
      }
    }
  }

  const tail = buffer.trim();
  if (tail) {
    const event = parseSSEChunk(tail);
    if (event) {
      events.push(event);
    }
  }

  return events;
}

function parseSSEChunk(chunk) {
  const lines = chunk.split("\n");
  const eventLine = lines.find((line) => line.startsWith("event:"));
  const dataLines = lines.filter((line) => line.startsWith("data:"));
  if (!eventLine || dataLines.length === 0) {
    return null;
  }

  const event = eventLine.slice("event:".length).trim();
  const rawData = dataLines.map((line) => line.slice("data:".length).trimStart()).join("\n");
  return {
    event,
    data: JSON.parse(rawData),
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function findEvent(events, eventName) {
  return events.find((event) => event.event === eventName);
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

// 正文保存会后台触发自动索引；如果后台任务尚未完成，状态仍可能是 pending/indexing。
const initialStatus = await request(`/api/v1/rag/documents/${document.id}/status`, { token });
assert(initialStatus.isInKnowledgeBase === true, "initial RAG status should be enabled");
assert(["pending", "indexing", "indexed"].includes(initialStatus.status), `initial RAG status should be pending/indexing/indexed, got ${initialStatus.status}`);
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

// RAG Chat 先做 query embedding 和 Qdrant search，再复用 AI Chat 的 SSE/落库协议。
const ragQuestion = "RAG smoke content 里提到了什么向量能力？";
const events = await streamRAGChat(token, {
  message: ragQuestion,
  topK: 3,
});
const conversationEvent = findEvent(events, "conversation");
const userMessageEvent = findEvent(events, "user_message");
const citationsEvent = findEvent(events, "citations");
const assistantMessageEvent = findEvent(events, "assistant_message");
const doneEvent = findEvent(events, "done");
const deltas = events.filter((event) => event.event === "message").map((event) => event.data.delta);

assert(conversationEvent?.data?.id, "RAG stream should include conversation event");
assert(userMessageEvent?.data?.role === "user", "RAG stream should include user_message event");
assert(userMessageEvent?.data?.content === ragQuestion, "RAG user_message should match prompt");
assert(citationsEvent?.data?.items?.length > 0, "RAG stream should include citations");
assert(
  citationsEvent.data.items.some((item) => item.documentId === document.id),
  "RAG citations should reference the indexed document",
);
assert(deltas.length > 0, "RAG stream should include message deltas");
assert(assistantMessageEvent?.data?.role === "assistant", "RAG stream should include assistant_message event");
assert(assistantMessageEvent?.data?.metadata?.rag?.enabled === true, "assistant metadata should enable RAG");
assert(
  assistantMessageEvent.data.metadata.rag.citations?.some((item) => item.documentId === document.id),
  "assistant metadata should persist RAG citations",
);
assert(doneEvent?.data?.conversationId === conversationEvent.data.id, "RAG done event should include conversation id");
console.log(`rag chat stream ok, citations=${citationsEvent.data.items.length}, deltas=${deltas.length}`);

const cleanupIndex = await request(`/api/v1/rag/documents/${document.id}/index`, {
  method: "DELETE",
  token,
});
assert(cleanupIndex.status === "disabled", "cleanup should disable RAG index before deleting document");
assert(cleanupIndex.chunkCount === 0, "cleanup should remove RAG chunks before deleting document");
console.log("cleanup rag index ok");

await request(`/api/v1/documents/${document.id}`, { method: "DELETE", token });
console.log("cleanup document ok");

console.log("rag smoke test passed");
