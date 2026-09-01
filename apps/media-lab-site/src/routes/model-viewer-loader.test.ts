import { describe, expect, it } from "vitest";
import { load } from "./live2d/[modelId]/+page.server";

const buildLoadEvent = (params: Record<string, string | undefined>) =>
  ({ params }) as unknown as Parameters<typeof load>[0];

describe("media-lab-site model viewer route shell", () => {
  it("returns stubbed route metadata for a valid model address", async () => {
    await expect(load(buildLoadEvent({ modelId: "sample-model" }))).resolves.toEqual({
      identity: { modelId: "sample-model" },
      viewerStatus: "unavailable-model-contract"
    });
  });

  it("trims the model id before returning the identity", async () => {
    await expect(load(buildLoadEvent({ modelId: " normal_miku_v3 " }))).resolves.toMatchObject({
      identity: { modelId: "normal_miku_v3" }
    });
  });

  it.each([undefined, "", "../escape", "a b"])(
    "rejects an unsafe model id (%s)",
    async (modelId) => {
      await expect(load(buildLoadEvent({ modelId }))).rejects.toMatchObject({ status: 404 });
    }
  );
});
