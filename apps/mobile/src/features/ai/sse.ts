export type MobileSSEEvent<TData = unknown> = {
  data: TData;
  event: string;
};

export type MobileSSEParser = {
  feed: (chunk: string) => MobileSSEEvent[];
  flush: () => MobileSSEEvent[];
};

// React Native fetch stream may split or merge SSE frames, so parser keeps incomplete tail data.
export function createMobileSSEParser(): MobileSSEParser {
  let buffer = "";

  return {
    feed(chunk) {
      buffer += chunk;
      const rawEvents = buffer.split("\n\n");
      buffer = rawEvents.pop() ?? "";
      return rawEvents.map(parseSSEEvent).filter((event): event is MobileSSEEvent => Boolean(event));
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

function parseSSEEvent(raw: string): MobileSSEEvent | null {
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
      data: JSON.parse(rawData),
      event,
    };
  } catch {
    return {
      data: rawData,
      event,
    };
  }
}
