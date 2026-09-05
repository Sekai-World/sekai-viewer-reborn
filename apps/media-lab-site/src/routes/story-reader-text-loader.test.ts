import { describe, expect, it } from "vitest";
import { load } from "./story-reader/[region]/[storyType]/[storyId]/+page.server";

const buildLoadEvent = (params: Record<string, string | undefined>) =>
  ({ params }) as unknown as Parameters<typeof load>[0];

describe("media-lab-site text-only story reader route shell", () => {
  it("returns stubbed route metadata for a valid story address", async () => {
    await expect(
      load(buildLoadEvent({ region: "jp", storyType: "unit", storyId: "1" }))
    ).resolves.toEqual({
      identity: { region: "jp", storyType: "unit", storyId: "1" },
      readerStatus: "awaiting-text-reader"
    });
  });

  it("normalizes the region before returning the identity", async () => {
    await expect(
      load(buildLoadEvent({ region: " JP ", storyType: "profile", storyId: " 12 " }))
    ).resolves.toMatchObject({
      identity: { region: "jp", storyType: "profile", storyId: "12" }
    });
  });

  it.each(["xx", undefined])("rejects an unsupported region (%s)", async (region) => {
    await expect(
      load(buildLoadEvent({ region, storyType: "unit", storyId: "1" }))
    ).rejects.toMatchObject({ status: 404 });
  });

  it.each(["song", "../unit"])("rejects an unsafe story type (%s)", async (storyType) => {
    await expect(
      load(buildLoadEvent({ region: "jp", storyType, storyId: "1" }))
    ).rejects.toMatchObject({ status: 404 });
  });

  it.each(["", "../1", "a b"])("rejects an unsafe story id (%s)", async (storyId) => {
    await expect(
      load(buildLoadEvent({ region: "jp", storyType: "unit", storyId }))
    ).rejects.toMatchObject({ status: 404 });
  });
});
