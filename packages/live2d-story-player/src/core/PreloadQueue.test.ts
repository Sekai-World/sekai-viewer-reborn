import { describe, expect, it } from "vitest";

import { PreloadQueue } from "./PreloadQueue.js";

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

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

  it("preserves task order while respecting the configured worker limit", async () => {
    const taskGates = Array.from({ length: 4 }, () => deferred<number>());
    const startSignals = Array.from({ length: 4 }, () => deferred<void>());
    const startOrder: number[] = [];
    let active = 0;
    let maxActive = 0;
    const tasks = taskGates.map((gate, index) => ({
      task: async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        startOrder.push(index);
        startSignals[index]?.resolve();
        try {
          return await gate.promise;
        } finally {
          active--;
        }
      }
    }));
    const run = new PreloadQueue(tasks, 2).run();

    await Promise.all([startSignals[0]?.promise, startSignals[1]?.promise]);
    expect(startOrder).toEqual([0, 1]);

    taskGates[1]?.resolve(1);
    await startSignals[2]?.promise;
    taskGates[2]?.resolve(2);
    await startSignals[3]?.promise;
    taskGates[3]?.resolve(3);
    taskGates[0]?.resolve(0);

    await expect(run).resolves.toEqual([0, 1, 2, 3]);
    expect(startOrder).toEqual([0, 1, 2, 3]);
    expect(maxActive).toBe(2);
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
