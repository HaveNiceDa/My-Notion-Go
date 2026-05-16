export type SSEEvent<TData = unknown> = {
  event: string;
  data: TData;
};

export type SSEParser = {
  feed: (chunk: string) => SSEEvent[];
  flush: () => SSEEvent[];
};

// createSSEParser 增量解析 text/event-stream。
// fetch stream 每次读到的 chunk 不保证正好按事件边界切开，所以这里保留未完成的 buffer。
export function createSSEParser(): SSEParser {
  let buffer = "";

  return {
    feed(chunk) {
      buffer += chunk;
      const rawEvents = buffer.split("\n\n");
      buffer = rawEvents.pop() ?? "";
      return rawEvents.map(parseSSEEvent).filter((event): event is SSEEvent => Boolean(event));
    },

    flush() {
      const tail = buffer.trim();
      buffer = "";
      if (!tail) {
        return [];
      }

      const event = parseSSEEvent(tail);
      return event ? [event] : [];
    },
  };
}

function parseSSEEvent(raw: string): SSEEvent | null {
  const lines = raw.split("\n");
  const eventLine = lines.find((line) => line.startsWith("event:"));
  const dataLines = lines.filter((line) => line.startsWith("data:"));
  if (!eventLine || dataLines.length === 0) {
    return null;
  }

  const event = eventLine.slice("event:".length).trim();
  const rawData = dataLines.map((line) => line.slice("data:".length).trimStart()).join("\n");
  try {
    return {
      event,
      data: JSON.parse(rawData),
    };
  } catch {
    return {
      event,
      data: rawData,
    };
  }
}
