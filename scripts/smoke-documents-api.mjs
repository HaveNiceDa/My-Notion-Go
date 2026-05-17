const baseUrl = process.env.API_BASE_URL ?? "http://localhost:8080";
const email = process.env.SMOKE_EMAIL ?? "demo@example.com";
const password = process.env.SMOKE_PASSWORD ?? "password123";
const deviceName = "documents-smoke-test";

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

async function requestFailure(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (response.ok && body?.success !== false) {
    throw new Error(`${options.method ?? "GET"} ${path} should fail but succeeded: ${JSON.stringify(body)}`);
  }
  return { body, status: response.status };
}

async function loginOrRegister() {
  try {
    return await request("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, deviceName }),
    });
  } catch (error) {
    console.log("login failed, trying register...");
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

const root = await request("/api/v1/documents", {
  method: "POST",
  token,
  body: JSON.stringify({ title: `Smoke Root ${new Date().toISOString()}`, icon: "📄" }),
});
console.log(`created root document ${root.id}`);

const child = await request("/api/v1/documents", {
  method: "POST",
  token,
  body: JSON.stringify({ parentId: root.id, title: "Smoke Child" }),
});
console.log(`created child document ${child.id}`);

const tree = await request("/api/v1/documents/tree", { token });
assert(Array.isArray(tree), "tree should be an array");
console.log(`tree size: ${tree.length}`);

const detail = await request(`/api/v1/documents/${root.id}`, { token });
assert(detail.id === root.id, "detail id should match root id");
console.log("detail ok");

const initialContent = await request(`/api/v1/documents/${root.id}/content`, { token });
assert(Array.isArray(initialContent.content), "initial content should be an array");
console.log("get content ok");

const blockNoteContent = [
  {
    type: "paragraph",
    content: [
      {
        type: "text",
        text: "Hello from smoke test",
        styles: {},
      },
    ],
  },
];
const updatedContent = await request(`/api/v1/documents/${root.id}/content`, {
  method: "PUT",
  token,
  body: JSON.stringify({ content: blockNoteContent }),
});
assert(updatedContent.version >= initialContent.version + 1, "content version should increase");
console.log(`update content ok, version=${updatedContent.version}`);

const published = await request(`/api/v1/documents/${root.id}/publish`, {
  method: "POST",
  token,
});
assert(published.isPublished === true, "published document should be marked as published");
assert(typeof published.publicId === "string" && published.publicId.length > 0, "published document should include publicId");
console.log(`publish ok, publicId=${published.publicId}`);

const publicDocument = await request(`/api/v1/public/documents/${published.publicId}`);
assert(publicDocument.publicId === published.publicId, "public document id should match publicId");
assert(publicDocument.title === root.title, "public document title should match current title before rename");
assert(Array.isArray(publicDocument.content), "public document content should be an array");
assert(JSON.stringify(publicDocument.content).includes("Hello from smoke test"), "public document content should include saved block text");
assert(publicDocument.id === undefined, "public document should not expose internal document id");
assert(publicDocument.path === undefined, "public document should not expose internal path");
assert(publicDocument.isInKnowledgeBase === undefined, "public document should not expose RAG state");
console.log("public read ok");

const unpublished = await request(`/api/v1/documents/${root.id}/publish`, {
  method: "DELETE",
  token,
});
assert(unpublished.isPublished === false, "unpublished document should not be marked as published");
console.log("unpublish ok");

const publicAfterUnpublish = await requestFailure(`/api/v1/public/documents/${published.publicId}`);
assert(publicAfterUnpublish.status === 404, "public document should be inaccessible after unpublish");
console.log("public read after unpublish rejected ok");

const updated = await request(`/api/v1/documents/${root.id}`, {
  method: "PATCH",
  token,
  body: JSON.stringify({ title: "Smoke Updated Title", isStarred: true }),
});
assert(updated.title === "Smoke Updated Title", "updated title should match");
console.log("metadata update ok");

const titleSearch = await request(`/api/v1/documents/search?q=${encodeURIComponent("Updated Title")}`, { token });
assert(titleSearch.some((result) => result.document.id === root.id && result.matchType === "title"), "search should match updated title");
console.log("title search ok");

const contentSearch = await request(`/api/v1/documents/search?q=${encodeURIComponent("Hello from smoke")}`, { token });
assert(contentSearch.some((result) => result.document.id === root.id), "search should match document content");
console.log("content search ok");

await request(`/api/v1/documents/${root.id}/archive`, { method: "POST", token });
console.log("archive ok");

const trash = await request("/api/v1/documents/trash", { token });
assert(trash.some((document) => document.id === root.id), "trash should include archived root");
console.log("trash ok");

await request(`/api/v1/documents/${root.id}/restore`, { method: "POST", token });
console.log("restore ok");

await request(`/api/v1/documents/${root.id}`, { method: "DELETE", token });
console.log("delete ok");

console.log("documents smoke test passed");
