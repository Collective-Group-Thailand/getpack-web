/** Starts a download without leaving the page. */
export function download(url: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.rel = "noopener";
  anchor.download = "";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

/** A file the API was still writing when the reads ran out. */
export class StillPendingError extends Error {
  constructor() {
    super("file.not_ready");
    this.name = "StillPendingError";
  }
}

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Reads an asynchronous export (a report run, the prospectus) until the worker has settled it.
 * The first read happens at once; between reads it waits `intervalMs`. A technical pacing, not a
 * business value: the API says when the file is done.
 */
export async function pollUntil<T>(
  read: () => Promise<T>,
  settled: (value: T) => boolean,
  {
    attempts = 30,
    intervalMs = 1000,
    wait = pause,
  }: { attempts?: number; intervalMs?: number; wait?: typeof pause } = {},
): Promise<T> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const value = await read();
    if (settled(value)) return value;
    if (attempt < attempts - 1) await wait(intervalMs);
  }
  throw new StillPendingError();
}
