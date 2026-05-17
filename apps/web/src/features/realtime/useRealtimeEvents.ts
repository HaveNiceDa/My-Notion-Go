import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useMemoizedFn, useUnmount } from "ahooks";
import { apiClient, notifyUnauthorized } from "@my-notion-go/api-client";
import { documentContentQueryKey, documentQueryKey, documentsQueryKey, documentsTrashQueryKey } from "../documents/queryKeys";

type RealtimeEvent = {
  id: string;
  type: string;
  documentId?: string;
  createdAt: string;
};

const documentSearchQueryKeyPrefix = ["documents", "search"] as const;
const reconnectDelayMs = 2000;

export function useRealtimeEvents(accessToken: string, enabled: boolean) {
  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);

  const handleEvent = useMemoizedFn((event: RealtimeEvent) => {
    if (event.type === "connected") {
      return;
    }

    // Realtime 事件只做缓存失效，最终数据仍以 PostgreSQL 查询结果为准，避免跨标签页状态漂移。
    void queryClient.invalidateQueries({ queryKey: documentsQueryKey });
    void queryClient.invalidateQueries({ queryKey: documentSearchQueryKeyPrefix });

    if (event.documentId) {
      void queryClient.invalidateQueries({ queryKey: documentQueryKey(event.documentId) });
    }

    if (event.type === "document.content_updated" && event.documentId) {
      void queryClient.invalidateQueries({ queryKey: documentContentQueryKey(event.documentId) });
    }

    if (event.type === "document.archived" || event.type === "document.restored" || event.type === "document.deleted") {
      void queryClient.invalidateQueries({ queryKey: documentsTrashQueryKey });
    }
  });

  useEffect(() => {
    if (!enabled || !accessToken) {
      return;
    }

    let stopped = false;
    let reconnectTimer: number | undefined;

    const connect = async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await streamRealtimeEvents(accessToken, controller.signal, handleEvent);
      } catch {
        if (!controller.signal.aborted && !stopped) {
          reconnectTimer = window.setTimeout(connect, reconnectDelayMs);
        }
      }
    };

    void connect();

    return () => {
      stopped = true;
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [accessToken, enabled, handleEvent]);

  useUnmount(() => {
    abortRef.current?.abort();
  });
}

async function streamRealtimeEvents(accessToken: string, signal: AbortSignal, onEvent: (event: RealtimeEvent) => void) {
  const response = await fetch(`${apiClient.baseUrl}/api/v1/realtime/events`, {
    method: "GET",
    headers: {
      Accept: "text/event-stream",
      Authorization: `Bearer ${accessToken}`,
    },
    signal,
  });

  if (response.status === 401) {
    notifyUnauthorized({
      path: "/api/v1/realtime/events",
      status: response.status,
      code: "UNAUTHORIZED",
    });
    return;
  }

  if (!response.ok || !response.body) {
    throw new Error(`Realtime stream failed with HTTP ${response.status}`);
  }

  // SSE 不是 JSON envelope；这里按 text/event-stream 协议解析 data 行，再把事件交给 React Query 失效逻辑。
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
      if (event) {
        onEvent(event);
      }
    }
  }
}

function parseSSEEvent(chunk: string): RealtimeEvent | null {
  const dataLines = chunk
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim());

  if (dataLines.length === 0) {
    return null;
  }

  try {
    return JSON.parse(dataLines.join("\n")) as RealtimeEvent;
  } catch {
    return null;
  }
}
