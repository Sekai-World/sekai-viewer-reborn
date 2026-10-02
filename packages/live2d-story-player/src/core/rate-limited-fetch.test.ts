import { beforeEach, describe, expect, it } from "vitest";

import { live2dRequest } from "./rate-limited-fetch.js";

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe("live2dRequest scheduler", () => {
  // The scheduler is a module-level singleton; let any leftover rate-limit
  // timestamps from a previous test fall out of the one-second window.
  beforeEach(async () => {
    await wait(1100);
  });

  it("keeps at most twenty requests in flight", async () => {
    let started = 0;
    const tasks = Array.from({ length: 25 }, () => {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      return {
        start: () => {
          started++;
          return gate;
        },
        release
      };
    });

    const requests = tasks.map((task) => live2dRequest(task.start));
    await wait(1200);

    expect(started).toBe(20);

    tasks.forEach((task) => task.release());
    await Promise.all(requests);
    expect(started).toBe(25);
  });

  it("starts at most twenty requests per rolling second", async () => {
    const starts: number[] = [];
    const run = async () => {
      starts.push(Date.now());
    };

    await Promise.all(Array.from({ length: 45 }, () => live2dRequest(run)));

    expect(starts).toHaveLength(45);
    for (let i = 0; i + 20 < starts.length; i++) {
      expect(starts[i + 20] - starts[i]).toBeGreaterThanOrEqual(950);
    }
  });

  it("cancels queued work without starting its request", async () => {
    let started = 0;
    const releases: (() => void)[] = [];
    const activeRequests = Array.from({ length: 20 }, () =>
      live2dRequest(
        () =>
          new Promise<void>((resolve) => {
            started++;
            releases.push(resolve);
          })
      )
    );
    await wait(0);
    expect(started).toBe(20);

    const controller = new AbortController();
    const abortReason = new Error("queued request canceled");
    let queuedRequestStarted = false;
    const queuedRequest = live2dRequest(async () => {
      queuedRequestStarted = true;
    }, controller.signal);
    controller.abort(abortReason);

    await expect(queuedRequest).rejects.toBe(abortReason);
    releases.forEach((release) => release());
    await Promise.all(activeRequests);
    expect(queuedRequestStarted).toBe(false);
  });

  it("cancels active work and observes its late request rejection", async () => {
    const controller = new AbortController();
    const abortReason = new Error("active request canceled");
    const lateFailure = new Error("late request rejection");
    let receivedSignal: AbortSignal | undefined;
    const request = live2dRequest(
      (signal) =>
        new Promise<void>((_resolve, reject) => {
          receivedSignal = signal;
          signal?.addEventListener("abort", () => setTimeout(() => reject(lateFailure), 0), {
            once: true
          });
        }),
      controller.signal
    );
    await wait(0);
    controller.abort(abortReason);

    await expect(request).rejects.toBe(abortReason);
    await wait(5);
    expect(receivedSignal).toBe(controller.signal);
  });
});
