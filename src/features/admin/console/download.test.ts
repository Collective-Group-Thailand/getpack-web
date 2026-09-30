import { describe, expect, it, vi } from "vitest";

import { pollUntil, StillPendingError } from "./download";

describe("pollUntil", () => {
  it("reads until the value settles, pausing between reads", async () => {
    const values = ["queued", "running", "succeeded"];
    const read = vi.fn(async () => values.shift()!);
    const wait = vi.fn(async () => {});
    await expect(pollUntil(read, (status) => status === "succeeded", { wait, intervalMs: 5 })).resolves.toBe(
      "succeeded",
    );
    expect(read).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(5);
  });

  it("gives up after the last attempt without a final pause", async () => {
    const wait = vi.fn(async () => {});
    await expect(
      pollUntil(
        async () => "pending",
        () => false,
        { attempts: 3, wait },
      ),
    ).rejects.toBeInstanceOf(StillPendingError);
    expect(wait).toHaveBeenCalledTimes(2);
  });
});
