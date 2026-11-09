import { describe, expect, it } from "vitest";
import { createSseParser, type SseMessage } from "../src/sse";

const parse = (...chunks: string[]) => {
  const out: SseMessage[] = [];
  const feed = createSseParser((m) => out.push(m));
  chunks.forEach(feed);
  return out;
};

describe("createSseParser", () => {
  it("parses id/event/data frames", () => {
    expect(parse('id: 1\nevent: package.updated\ndata: {"a":1}\n\n')).toEqual([
      { id: "1", event: "package.updated", data: '{"a":1}' },
    ]);
  });

  it("joins frames split across chunks, even mid-line and between CR and LF", () => {
    expect(parse("id: 1\r", "\nevent: task.ch", "anged\r\ndata: x\r\n", "\r\n")).toEqual([
      { id: "1", event: "task.changed", data: "x" },
    ]);
  });

  it("joins multi-line data with newlines", () => {
    expect(parse("data: a\ndata: b\n\n")).toEqual([
      { id: undefined, event: "message", data: "a\nb" },
    ]);
  });

  it("ignores comments (heartbeats) and frames without data", () => {
    expect(parse(": ping\n\n: connected\n\nevent: x\n\n")).toEqual([]);
  });

  it("keeps the last id for the following frames (Last-Event-ID)", () => {
    expect(parse("id: 7\ndata: a\n\ndata: b\n\n").map((m) => m.id)).toEqual(["7", "7"]);
  });

  it("does not emit an unterminated frame", () => {
    expect(parse("data: half")).toEqual([]);
  });
});
