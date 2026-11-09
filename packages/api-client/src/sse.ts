// Incremental text/event-stream parser (WHATWG SSE subset): feed decoded text chunks, get complete messages.
export interface SseMessage {
  /** Last `id:` seen on this stream — what the next connection sends as Last-Event-ID. */
  id: string | undefined;
  event: string;
  data: string;
}

// shortcut: lines end in LF or CRLF; bare-CR line endings are not supported (our servers never send them).
export function createSseParser(onMessage: (m: SseMessage) => void) {
  let buffer = "";
  let data: string[] = [];
  let event = "";
  let id: string | undefined;
  return (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const raw of lines) {
      const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
      if (line === "") {
        if (data.length) onMessage({ id, event: event || "message", data: data.join("\n") });
        data = [];
        event = "";
        continue;
      }
      if (line.startsWith(":")) continue; // comment, e.g. the `: ping` heartbeat
      const colon = line.indexOf(":");
      const field = colon < 0 ? line : line.slice(0, colon);
      const value = colon < 0 ? "" : line.slice(colon + 1).replace(/^ /, "");
      if (field === "data") data.push(value);
      else if (field === "event") event = value;
      else if (field === "id") id = value;
    }
  };
}
