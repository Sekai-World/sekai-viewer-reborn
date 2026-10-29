import { describe, expect, it } from "vitest";
import { deriveStoryPlayerStatus, type StoryPlayerStatusInput } from "./story-player-status";

const input = (overrides: Partial<StoryPlayerStatusInput> = {}): StoryPlayerStatusInput => ({
  loadStarted: true,
  sessionState: "loading",
  loadFailed: false,
  hasStarted: false,
  warningCount: 0,
  ...overrides
});

describe("deriveStoryPlayerStatus", () => {
  it("is idle until loading was requested", () => {
    expect(deriveStoryPlayerStatus(input({ loadStarted: false })).phase).toBe("idle");
  });

  it("reports loading while the session loads", () => {
    expect(deriveStoryPlayerStatus(input()).phase).toBe("loading");
  });

  it("separates ready before the first step from waiting at a checkpoint", () => {
    expect(deriveStoryPlayerStatus(input({ sessionState: "ready" })).phase).toBe("ready");
    expect(deriveStoryPlayerStatus(input({ sessionState: "ready", hasStarted: true })).phase).toBe(
      "waiting"
    );
  });

  it("reports playing and finished from the session state", () => {
    expect(deriveStoryPlayerStatus(input({ sessionState: "playing" })).phase).toBe("playing");
    expect(deriveStoryPlayerStatus(input({ sessionState: "finished" })).phase).toBe("finished");
  });

  it("lets a failed load win over any session state", () => {
    expect(deriveStoryPlayerStatus(input({ loadFailed: true, sessionState: "ready" })).phase).toBe(
      "error"
    );
    expect(deriveStoryPlayerStatus(input({ sessionState: "error" })).phase).toBe("error");
  });

  it("returns to idle once the session is destroyed", () => {
    expect(deriveStoryPlayerStatus(input({ sessionState: "destroyed" })).phase).toBe("idle");
  });

  it("flags warnings independently of the phase", () => {
    expect(deriveStoryPlayerStatus(input({ sessionState: "playing", warningCount: 2 }))).toEqual({
      phase: "playing",
      warning: true
    });
    expect(deriveStoryPlayerStatus(input({ sessionState: "playing" })).warning).toBe(false);
  });
});
