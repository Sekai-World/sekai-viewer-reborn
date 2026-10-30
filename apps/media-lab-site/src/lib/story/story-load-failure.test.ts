import { describe, expect, it, vi } from "vitest";
import { Live2DMediaLoadError } from "@platform/live2d-story-player";
import { classifyStoryLoadFailure } from "./story-load-failure";

const mediaError = new Live2DMediaLoadError("sound", "https://assets.example/voice.mp3");

describe("classifyStoryLoadFailure", () => {
  it("reports a media file the asset host does not have as media-missing", async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 404 }));
    expect(await classifyStoryLoadFailure(mediaError, fetchFn)).toBe("media-missing");
    expect(fetchFn).toHaveBeenCalledWith("https://assets.example/voice.mp3", { method: "HEAD" });
  });

  it.each([200, 403, 500, 503])("keeps a media failure with status %i generic", async (status) => {
    const fetchFn = vi.fn(async () => new Response(null, { status }));
    expect(await classifyStoryLoadFailure(mediaError, fetchFn)).toBe("failed");
  });

  it("keeps the failure generic when the probe itself fails", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("network down");
    });
    expect(await classifyStoryLoadFailure(mediaError, fetchFn)).toBe("failed");
  });

  it("does not probe anything for non-media failures", async () => {
    const fetchFn = vi.fn();
    expect(await classifyStoryLoadFailure(new Error("scenario broke"), fetchFn)).toBe("failed");
    expect(await classifyStoryLoadFailure("boom", fetchFn)).toBe("failed");
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
