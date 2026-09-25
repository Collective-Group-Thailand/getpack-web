import { describe, expect, it } from "vitest";

import { streamUrl } from "./RealtimeProvider";
import { backoffMs, createSseParser, type SseFrame } from "./sse";

function parse(...chunks: string[]): SseFrame[] {
  const frames: SseFrame[] = [];
  const parser = createSseParser((frame) => frames.push(frame));
  for (const chunk of chunks) parser.push(chunk);
  return frames;
}

describe("createSseParser", () => {
  it("delivers named events — the ones EventSource's message listener never hears", () => {
    // The exact example in the contract for GET /v1/admin/realtime/stream.
    const frames = parse(
      'event: notification.created\ndata: {"type":"notification.created","id":"e1","channel":"user:u1"}\n\n',
    );
    expect(frames).toEqual([
      { event: "notification.created", data: '{"type":"notification.created","id":"e1","channel":"user:u1"}', id: undefined },
    ]);
  });

  it("reassembles a frame split across chunks, mid-line", () => {
    expect(parse("event: order.pa", 'id\ndata: {"ty', 'pe":"order.paid"}\n', "\n")).toEqual([
      { event: "order.paid", data: '{"type":"order.paid"}', id: undefined },
    ]);
  });

  it("accepts CRLF and CR line endings", () => {
    expect(parse("data: a\r\n\r\ndata: b\r\r")).toEqual([
      { event: "message", data: "a", id: undefined },
      { event: "message", data: "b", id: undefined },
    ]);
  });

  it("ignores heartbeat comments and never dispatches an empty frame", () => {
    expect(parse(": keep-alive\n\n: keep-alive\n\n")).toEqual([]);
  });

  it("joins multi-line data with newlines and keeps the id", () => {
    expect(parse("id: 7\ndata: one\ndata: two\n\n")).toEqual([{ event: "message", data: "one\ntwo", id: "7" }]);
  });

  it("does not dispatch a frame until its blank line arrives", () => {
    expect(parse("data: pending\n")).toEqual([]);
  });
});

describe("backoffMs", () => {
  it("grows exponentially from a second and caps at a minute", () => {
    const max = () => 1;
    expect(backoffMs(0, max)).toBe(1_000);
    expect(backoffMs(3, max)).toBe(8_000);
    expect(backoffMs(20, max)).toBe(60_000);
  });

  it("jitters between half and all of the base, so reconnects do not stampede", () => {
    expect(backoffMs(2, () => 0)).toBe(2_000);
    expect(backoffMs(2, () => 1)).toBe(4_000);
  });
});

describe("streamUrl", () => {
  it("reads the stream through this zone's BFF, with the channel token", () => {
    expect(streamUrl("admin", "/v1/admin/realtime/stream", "a b")).toBe("/bff/v1/admin/realtime/stream?token=a%20b");
  });

  it("refuses a stream path on another surface, or one that climbs out", () => {
    expect(streamUrl("admin", "/v1/store/realtime/stream", "t")).toBeNull();
    expect(streamUrl("partner", "https://evil.example/stream", "t")).toBeNull();
    expect(streamUrl("admin", "/v1/admin/../store/realtime/stream", "t")).toBeNull();
    expect(streamUrl("admin", "/v1/admin/realtime/stream?token=forged", "t")).toBeNull();
  });
});
