import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const embeddingModel = "tongyi-embedding-vision-plus-2026-03-06";
const embeddingDimension = 1024;
const env = loadEnvFile(resolve(process.cwd(), ".env"));
const dashScopeApiKey = firstNonEmpty(process.env.DASHSCOPE_API_KEY, process.env.LLM_API_KEY, env.DASHSCOPE_API_KEY, env.LLM_API_KEY);
const dashScopeApiBaseUrl = trimTrailingSlash(firstNonEmpty(process.env.DASHSCOPE_API_BASE_URL, env.DASHSCOPE_API_BASE_URL, "https://dashscope.aliyuncs.com/api/v1"));
const qdrantUrl = trimTrailingSlash(firstNonEmpty(process.env.QDRANT_URL, env.QDRANT_URL, "http://localhost:6333"));
const qdrantApiKey = firstNonEmpty(process.env.QDRANT_API_KEY, env.QDRANT_API_KEY);
const smokeCollection = `my_notion_go_smoke_${Date.now()}`;

assert(dashScopeApiKey, "DASHSCOPE_API_KEY or LLM_API_KEY is required for embedding smoke.");

await qdrantHealth();
console.log(`qdrant health ok, url=${qdrantUrl}`);

const vector = await createEmbedding("My-Notion Go embedding smoke test.");
assert(Array.isArray(vector), "embedding vector should be an array");
assert(vector.length === embeddingDimension, `embedding dimension should be ${embeddingDimension}, got ${vector.length}`);
console.log(`embedding ok, model=${embeddingModel}, dimension=${vector.length}`);

try {
  await createCollection(smokeCollection, vector.length);
  console.log(`qdrant collection created: ${smokeCollection}`);

  const pointId = randomUUID();
  await upsertPoint(smokeCollection, pointId, vector);
  console.log(`qdrant upsert ok, point=${pointId}`);

  const results = await searchPoint(smokeCollection, vector);
  assert(results.some((item) => item.id === pointId), "qdrant search should return the upserted point");
  console.log(`qdrant search ok, result count=${results.length}`);
} finally {
  await deleteCollection(smokeCollection).catch((error) => {
    console.warn(`qdrant cleanup warning: ${error.message}`);
  });
}

console.log("embedding qdrant smoke test passed");

async function createEmbedding(text) {
  const response = await fetch(`${dashScopeApiBaseUrl}/services/embeddings/multimodal-embedding/multimodal-embedding`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${dashScopeApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: embeddingModel,
      input: {
        contents: [
          {
            text,
          },
        ],
      },
      parameters: {
        output_type: "dense",
        dimension: embeddingDimension,
      },
    }),
  });

  const body = await readJsonResponse(response);
  if (!response.ok) {
    throw new Error(`POST /multimodal-embedding failed: ${response.status} ${formatErrorBody(body)}`);
  }

  if (body?.code) {
    throw new Error(`DashScope embedding failed: ${body.code}: ${body.message ?? ""}`);
  }

  const embedding = body?.output?.embeddings?.[0];
  assert(embedding?.index === 0, `embedding response index should be 0, got ${embedding?.index}`);
  assert(embedding?.type === "text", `embedding response type should be text, got ${embedding?.type}`);
  return embedding.embedding;
}

async function qdrantHealth() {
  const response = await fetch(`${qdrantUrl}/healthz`, {
    headers: qdrantHeaders(),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`GET /healthz failed: ${response.status} ${body}`);
  }
}

async function createCollection(collection, dimension) {
  // Smoke 使用临时 collection，避免污染正式 RAG collection，也能验证 collection 创建权限和向量维度配置。
  const response = await fetch(`${qdrantUrl}/collections/${encodeURIComponent(collection)}`, {
    method: "PUT",
    headers: qdrantHeaders(),
    body: JSON.stringify({
      vectors: {
        size: dimension,
        distance: "Cosine",
      },
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`PUT /collections/${collection} failed: ${response.status} ${body}`);
  }
}

async function upsertPoint(collection, pointId, vector) {
  const response = await fetch(`${qdrantUrl}/collections/${encodeURIComponent(collection)}/points?wait=true`, {
    method: "PUT",
    headers: qdrantHeaders(),
    body: JSON.stringify({
      points: [
        {
          id: pointId,
          vector,
          payload: {
            source: "embedding-smoke",
          },
        },
      ],
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`PUT /collections/${collection}/points failed: ${response.status} ${body}`);
  }
}

async function searchPoint(collection, vector) {
  const response = await fetch(`${qdrantUrl}/collections/${encodeURIComponent(collection)}/points/search`, {
    method: "POST",
    headers: qdrantHeaders(),
    body: JSON.stringify({
      vector,
      limit: 3,
      with_payload: true,
    }),
  });
  const body = await readJsonResponse(response);
  if (!response.ok) {
    throw new Error(`POST /collections/${collection}/points/search failed: ${response.status} ${formatErrorBody(body)}`);
  }
  return body?.result ?? [];
}

async function deleteCollection(collection) {
  const response = await fetch(`${qdrantUrl}/collections/${encodeURIComponent(collection)}`, {
    method: "DELETE",
    headers: qdrantHeaders(),
  });
  if (!response.ok && response.status !== 404) {
    const body = await response.text().catch(() => "");
    throw new Error(`DELETE /collections/${collection} failed: ${response.status} ${body}`);
  }
  console.log(`qdrant cleanup ok: ${collection}`);
}

function qdrantHeaders() {
  return {
    "Content-Type": "application/json",
    ...(qdrantApiKey ? { "api-key": qdrantApiKey } : {}),
  };
}

async function readJsonResponse(response) {
  const text = await response.text().catch(() => "");
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const result = {};
  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");
    result[key] = value;
  }
  return result;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function formatErrorBody(body) {
  if (typeof body === "string") {
    return body;
  }
  return JSON.stringify(body);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
