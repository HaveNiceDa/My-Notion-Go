const baseUrl = process.env.API_BASE_URL ?? "http://localhost:8080";
const email = process.env.SMOKE_EMAIL ?? "demo@example.com";
const password = process.env.SMOKE_PASSWORD ?? "password123";
const deviceName = "realtime-smoke-test";
const realtimeTimeoutMs = Number(process.env.SMOKE_REALTIME_TIMEOUT_MS ?? 8000);

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

async function waitForRealtimeEvent(token, expected) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("Realtime smoke timeout.")), realtimeTimeoutMs);

  try {
    const eventPromise = readRealtimeStream(token, controller.signal, expected);
    // Start the SSE subscription first, then trigger the mutation so the event cannot race ahead of the listener.
    await wait(250);
    await expected.trigger();
    return await eventPromise;
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}

async function readRealtimeStream(token, signal, expected) {
  const response = await fetch(`${baseUrl}/api/v1/realtime/events`, {
    method: "GET",
    headers: {
      Accept: "text/event-stream",
      Authorization: `Bearer ${token}`,
    },
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`GET /api/v1/realtime/events failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (!signal.aborted) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const event = parseSSEEvent(chunk);
      if (!event) {
        continue;
      }
      console.log(`received realtime event: ${event.type}`);
      if (event.type === expected.type && event.documentId === expected.documentId) {
        return event;
      }
    }
  }

  throw new Error(`Realtime stream ended before ${expected.type} was received.`);
}

function parseSSEEvent(chunk) {
  const dataLines = chunk
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim());

  if (dataLines.length === 0) {
    return null;
  }

  try {
    return JSON.parse(dataLines.join("\n"));
  } catch {
    return null;
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const auth = await loginOrRegister();
const token = auth.tokens.accessToken;
console.log(`authenticated as ${auth.user.email}`);

const document = await request("/api/v1/documents", {
  method: "POST",
  token,
  body: JSON.stringify({ title: `Realtime Smoke ${new Date().toISOString()}` }),
});
console.log(`created document ${document.id}`);

const blockNoteContent = [
  {
    type: "paragraph",
    content: [
      {
        type: "text",
        text: `Realtime smoke content ${new Date().toISOString()}`,
        styles: {},
      },
    ],
  },
];

const event = await waitForRealtimeEvent(token, {
  type: "document.content_updated",
  documentId: document.id,
  trigger: () =>
    request(`/api/v1/documents/${document.id}/content`, {
      method: "PUT",
      token,
      body: JSON.stringify({ content: blockNoteContent }),
    }),
});

assert(event.type === "document.content_updated", "event type should be document.content_updated");
assert(event.documentId === document.id, "event documentId should match updated document");
assert(typeof event.id === "string" && event.id.length > 0, "event should include id");
assert(typeof event.createdAt === "string" && event.createdAt.length > 0, "event should include createdAt");
console.log(`content updated event ok, eventId=${event.id}`);

await request(`/api/v1/documents/${document.id}`, { method: "DELETE", token });
console.log("cleanup ok");

console.log("realtime smoke test passed");
