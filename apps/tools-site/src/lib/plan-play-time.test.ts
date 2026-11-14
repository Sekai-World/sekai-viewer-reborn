import { describe, expect, it } from "vitest";
import { formatPlayTime } from "#lib/plan-play-time.js";

describe("formatPlayTime", () => {
  it("shows vector R1: ten lives of 123.2 s with 60 s of overhead", () => {
    expect(formatPlayTime(10 * (1_232 + 600))).toBe("30:32");
  });

  it("rounds to the second, half up", () => {
    expect(formatPlayTime(0)).toBe("0:00");
    expect(formatPlayTime(4)).toBe("0:00");
    expect(formatPlayTime(5)).toBe("0:01");
    expect(formatPlayTime(594)).toBe("0:59");
    expect(formatPlayTime(595)).toBe("1:00");
    expect(formatPlayTime(599)).toBe("1:00");
  });

  it("adds hours once there are any", () => {
    expect(formatPlayTime(35_990)).toBe("59:59");
    expect(formatPlayTime(35_995)).toBe("1:00:00");
    expect(formatPlayTime(36_000 + 5 * 600 + 70)).toBe("1:05:07");
    expect(formatPlayTime(100 * 36_000)).toBe("100:00:00");
  });
});
