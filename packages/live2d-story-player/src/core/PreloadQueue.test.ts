import { describe, expect, it } from "vitest";

import { PreloadQueue } from "./PreloadQueue.js";

describe("PreloadQueue", () => {
  it("propagates a task failure, aborts active work, and skips queued tasks", async () => {
    const failure = new Error("asset failure");
    let activeSignal: AbortSignal | undefined;
    const started: number[] = [];
    const queue = new PreloadQueue<number>(
      [
        {
          task: (signal) => {
            started.push(0);
            activeSignal = signal;
            return new Promise<number>((_resolve, reject) => {
              signal.addEventListener("abort", () => reject(signal.reason), { once: true });
            });
          }
        },
        {
          task: async () => {
            started.push(1);
            throw failure;
          }
        },
        {
          task: async () => {
            started.push(2);
            return 2;
          }
        }
      ],
      2
    );

    await expect(queue.run()).rejects.toBe(failure);
    expect(started).toEqual([0, 1]);
    expect(activeSignal?.aborted).toBe(true);
  });

  it("cancels in-flight work when the caller aborts and handles its late rejection", async () => {
    const controller = new AbortController();
    const abortReason = new Error("caller canceled");
    const lateFailure = new Error("late task failure");
    let activeSignal: AbortSignal | undefined;
    let started = 0;
    const queue = new PreloadQueue<number>(
      [
        {
          task: (signal) => {
            started++;
            activeSignal = signal;
            return new Promise<number>((_resolve, reject) => {
              signal.addEventListener("abort", () => setTimeout(() => reject(lateFailure), 0), {
                once: true
              });
            });
          }
        },
        {
          task: async () => {
            started++;
            return 2;
          }
        }
      ],
      1,
      60,
      controller.signal
    );

    const run = queue.run();
    await Promise.resolve();
    await Promise.resolve();
    controller.abort(abortReason);

    await expect(run).rejects.toBe(abortReason);
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
    expect(activeSignal?.aborted).toBe(true);
    expect(started).toBe(1);
  });

  it("aborts the queue when a task times out", async () => {
    let activeSignal: AbortSignal | undefined;
    const queue = new PreloadQueue<number>(
      [
        {
          task: (signal) => {
            activeSignal = signal;
            return new Promise<number>((_resolve, reject) => {
              signal.addEventListener("abort", () => reject(signal.reason), { once: true });
            });
          }
        }
      ],
      1,
      0.01
    );

    await expect(queue.run()).rejects.toThrow("Promise timeout");
    expect(activeSignal?.aborted).toBe(true);
  });
});
