import { beforeEach, describe, expect, it } from "vitest";

import { live2dRequest } from "./rate-limited-fetch";

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
});
