import { ApiError, apiClient, type AIConversation, type AIMessage, type StreamAIChatRequest } from "@my-notion-go/api-client";
import { createSSEParser } from "./sse";
import type { AIChatMode, AIChatStreamEvent, RAGCitation } from "./types";

type StreamAIChatOptions = {
  accessToken: string;
  input: StreamAIChatRequest;
  mode: AIChatMode;
  signal?: AbortSignal;
  onEvent: (event: AIChatStreamEvent) => void;
};

export const webAIChatApi = {
  streamChat,
};

async function streamChat({ accessToken, input, mode, signal, onEvent }: StreamAIChatOptions) {
  // SSE 不能走 api-client 的 JSON envelope 拆包逻辑；这里单独用 fetch 保留 ReadableStream。
  const endpoint = mode === "rag" ? "/api/v1/rag/chat/stream" : "/api/v1/ai/chat/stream";
  const response = await fetch(`${apiClient.baseUrl}${endpoint}`, {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok || !response.body) {
    const errorMessage = await readErrorMessage(response);
    throw new ApiError(errorMessage, response.status);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parser = createSSEParser();

  // 浏览器可能把一个 SSE 事件拆成多个二进制 chunk，也可能把多个事件合并到一个 chunk。
  // parser.feed 负责缓存半包，Hook 只消费已经完整解析出的业务事件。
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    const events = parser.feed(decoder.decode(value, { stream: true }));
    events.forEach((event) => onEvent(normalizeStreamEvent(event.event, event.data)));
  }

  const tailEvents = parser.flush();
  tailEvents.forEach((event) => onEvent(normalizeStreamEvent(event.event, event.data)));
}

async function readErrorMessage(response: Response) {
  const text = await response.text().catch(() => "");
  if (!text) {
    return `HTTP ${response.status}`;
  }

  try {
    const body = JSON.parse(text) as {
      error?: {
        message?: string;
      };
    };
    return body.error?.message ?? text;
  } catch {
    return text;
  }
}

function normalizeStreamEvent(event: string, data: unknown): AIChatStreamEvent {
  switch (event) {
    case "conversation":
      return { event, data: data as AIConversation };
    case "user_message":
      return { event, data: data as AIMessage };
    case "message":
      return { event, data: data as { delta: string } };
    case "citations":
      return { event, data: data as { items: RAGCitation[] } };
    case "assistant_message":
      return { event, data: data as AIMessage };
    case "done":
      return { event, data: data as { conversationId: string } };
    case "error":
      return { event, data: data as { code?: string; message?: string } };
    default:
      return {
        event: "error",
        data: {
          code: "UNKNOWN_SSE_EVENT",
          message: `Unknown SSE event: ${event}`,
        },
      };
  }
}
