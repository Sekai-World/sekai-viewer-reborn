import { describe, expect, it } from "vitest";
import { load } from "./+page.server";

type LoadEvent = Parameters<typeof load>[0];

const runLoad = (modelName: string) => load({ params: { modelName } } as LoadEvent);

describe("Chibi viewer page load", () => {
  it("returns the asset descriptor of a well-formed model name", () => {
    expect(runLoad("sd_01ichika_normal")).toMatchObject({
      descriptor: { modelName: "sd_01ichika_normal", family: "main", region: "jp" }
    });
  });

  it.each(["unknown_model", "sd_", "SD_01ichika_normal", "sd_../secret"])(
    "answers 404 for %s",
    (modelName) => {
      expect(() => runLoad(modelName)).toThrow(expect.objectContaining({ status: 404 }));
    }
  );
});
