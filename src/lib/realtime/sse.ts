/**
 * A server-sent-events reader over `fetch`, for the stream packio-api B1.3 published.
 *
 * Why not `EventSource`: the contract's frames are **named** (`event: notification.created`),
 * and `EventSource` delivers a named event only to a listener registered for that exact name —
 * there is no wildcard, so a `message` listener hears nothing at all, and the event names are
 * data the backend adds to over time. And the stream is authorised by a **60-second channel
 * token** in the query string (`POST …/realtime/auth`), which `EventSource` would keep
 * resending on every automatic reconnect long after it expired. Reading the stream with
 * `fetch` fixes both: every frame reaches one handler, and every connection starts with a
 * fresh token.
 */

export interface SseFrame {
  /** `event:` — `message` when the frame names none, as the SSE spec says. */
  event: string;
  /** `data:` lines joined with `\n`. */
  data: string;
  /** `id:`, when sent. */
  id?: string;
}

/**
 * Incremental SSE parsing (WHATWG HTML §9.2.6), fed arbitrary chunks.
 *
 * Kept free of `fetch` so it can be tested with the awkward inputs that break naive parsers: a
 * frame split across chunks, CRLF line endings, a comment heartbeat, a multi-line `data`.
 */
export function createSseParser(onFrame: (frame: SseFrame) => void) {
  let buffer = "";
  let event = "";
  let data: string[] = [];
  let id: string | undefined;

  function dispatch() {
    if (data.length > 0) onFrame({ event: event || "message", data: data.join("\n"), id });
    event = "";
    data = [];
    id = undefined;
  }

  function line(text: string) {
    if (text === "") return dispatch();
    // A line starting with a colon is a comment — the heartbeat that keeps proxies awake.
    if (text.startsWith(":")) return;

    const colon = text.indexOf(":");
    const field = colon === -1 ? text : text.slice(0, colon);
    let value = colon === -1 ? "" : text.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);

    if (field === "event") event = value;
    else if (field === "data") data.push(value);
    else if (field === "id") id = value;
    // `retry` and unknown fields are ignored: the caller owns reconnection.
  }

  return {
    push(chunk: string) {
      buffer += chunk;
      const lines = buffer.split(/\r\n|\r|\n/);
      // The last piece may be half a line; keep it for the next chunk.
      buffer = lines.pop() ?? "";
      for (const text of lines) line(text);
    },
  };
}

/** Reads one SSE response to its end, or until `signal` aborts. */
export async function readSse(response: Response, onFrame: (frame: SseFrame) => void, signal: AbortSignal) {
  if (!response.body) return;
  const parser = createSseParser(onFrame);
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  try {
    while (!signal.aborted) {
      const { value, done } = await reader.read();
      if (done) return;
      parser.push(value);
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * The wait before reconnect attempt `n` (0-based): exponential from one second, capped at a
 * minute, with jitter so a deploy that drops every connection at once does not bring them all
 * back in the same millisecond.
 */
export function backoffMs(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(60_000, 1_000 * 2 ** attempt);
  return Math.round(base / 2 + (random() * base) / 2);
}
