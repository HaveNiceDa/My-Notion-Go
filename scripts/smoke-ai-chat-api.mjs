const baseUrl = process.env.API_BASE_URL ?? "http://localhost:8080";
const email = process.env.SMOKE_EMAIL ?? "demo@example.com";
const password = process.env.SMOKE_PASSWORD ?? "password123";
const deviceName = "ai-chat-smoke-test";

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
  } catch (error) {
    console.log("login failed, trying register...");
    return request("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name: "Smoke Tester" }),
    });
  }
}

async function streamChat(token, payload) {
  const response = await fetch(`${baseUrl}/api/v1/ai/chat/stream`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok || !response.body) {
    const body = await response.text().catch(() => "");
    throw new Error(`POST /api/v1/ai/chat/stream failed: ${response.status} ${body}`);
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

const conversation = await request("/api/v1/ai/conversations", {
  method: "POST",
  token,
  body: JSON.stringify({ title: `Smoke AI ${new Date().toISOString()}` }),
});
assert(conversation.id, "created conversation should include id");
console.log(`created conversation ${conversation.id}`);

const conversations = await request("/api/v1/ai/conversations", { token });
assert(
  conversations.some((item) => item.id === conversation.id),
  "conversation list should include created conversation",
);
console.log(`conversation list ok, size=${conversations.length}`);

const prompt = "用一句话验证 AI Chat SSE 自动化脚本。";
const events = await streamChat(token, {
  conversationId: conversation.id,
  message: prompt,
});

const conversationEvent = findEvent(events, "conversation");
const userMessageEvent = findEvent(events, "user_message");
const assistantMessageEvent = findEvent(events, "assistant_message");
const doneEvent = findEvent(events, "done");
const deltas = events.filter((event) => event.event === "message").map((event) => event.data.delta);

assert(conversationEvent?.data?.id === conversation.id, "conversation event should match conversation id");
assert(userMessageEvent?.data?.role === "user", "user_message event should include user role");
assert(deltas.length > 0, "SSE should include message delta events");
assert(assistantMessageEvent?.data?.role === "assistant", "assistant_message event should include assistant role");
assert(assistantMessageEvent?.data?.content?.length > 0, "assistant_message event should include content");
assert(doneEvent?.data?.conversationId === conversation.id, "done event should include conversation id");
console.log(`stream ok, delta count=${deltas.length}`);

const messages = await request(`/api/v1/ai/conversations/${conversation.id}/messages`, { token });
assert(messages.some((message) => message.role === "user" && message.content === prompt), "messages should include user prompt");
assert(
  messages.some((message) => message.role === "assistant" && message.content.length > 0),
  "messages should include persisted assistant response content",
);
console.log(`messages persisted ok, size=${messages.length}`);

console.log("ai chat smoke test passed");
