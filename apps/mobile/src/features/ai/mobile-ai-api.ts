import {
  ApiError,
  aiChatApi,
  apiClient,
  notifyUnauthorized,
  type AIConversation,
  type AIMessage,
  type StreamAIChatRequest,
} from "@my-notion-go/api-client";
import { fetch } from "expo/fetch";
import { createMobileSSEParser } from "./sse";
import type { MobileAIChatMode, MobileAIStreamEvent, MobileRAGCitation } from "./types";

type StreamMobileAIChatOptions = {
  accessToken: string;
  input: StreamAIChatRequest;
  mode: MobileAIChatMode;
  onEvent: (event: MobileAIStreamEvent) => void;
  signal?: AbortSignal;
};

export const mobileAIApi = {
  conversations: aiChatApi.conversations,
  createConversation: aiChatApi.createConversation,
  messages: aiChatApi.messages,
  streamChat,
};

async function streamChat({ accessToken, input, mode, onEvent, signal }: StreamMobileAIChatOptions) {
  const endpoint = mode === "rag" ? "/api/v1/rag/chat/stream" : "/api/v1/ai/chat/stream";
  const response = await fetch(`${apiClient.baseUrl}${endpoint}`, {
    body: JSON.stringify(input),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    method: "POST",
    signal,
  });

  if (!response.ok) {
    const errorMessage = await readErrorMessage(response);
    if (response.status === 401) {
      notifyUnauthorized({
        code: "UNAUTHORIZED",
        path: endpoint,
        status: response.status,
      });
    }
    throw new ApiError(errorMessage, response.status);
  }

  const parser = createMobileSSEParser();

  // Streaming responses cannot use the shared JSON envelope request helper.
  // We keep the ReadableStream open and normalize SSE frames for the mobile chat screen.
  if (!response.body || !("getReader" in response.body)) {
    const text = await response.text();
    parser.feed(text).forEach((event) => onEvent(normalizeStreamEvent(event.event, event.data)));
    parser.flush().forEach((event) => onEvent(normalizeStreamEvent(event.event, event.data)));
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    const events = parser.feed(decoder.decode(value, { stream: true }));
    events.forEach((event) => onEvent(normalizeStreamEvent(event.event, event.data)));
  }

  parser.flush().forEach((event) => onEvent(normalizeStreamEvent(event.event, event.data)));
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

function normalizeStreamEvent(event: string, data: unknown): MobileAIStreamEvent {
  switch (event) {
    case "conversation":
      return { data: data as AIConversation, event };
    case "user_message":
      return { data: data as AIMessage, event };
    case "message":
      return { data: data as { delta: string }, event };
    case "citations":
      return { data: data as { items: MobileRAGCitation[] }, event };
    case "assistant_message":
      return { data: data as AIMessage, event };
    case "done":
      return { data: data as { conversationId: string }, event };
    case "error":
      return { data: data as { code?: string; message?: string }, event };
    default:
      return {
        data: {
          code: "UNKNOWN_SSE_EVENT",
          message: `Unknown SSE event: ${event}`,
        },
        event: "error",
      };
  }
}
