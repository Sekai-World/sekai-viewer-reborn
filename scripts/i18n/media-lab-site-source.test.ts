import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { collectTranslatorKeys } from "./media-lab-site-source.mjs";

describe("media-lab-site i18n source collection", () => {
  it("collects literal keys from translate calls", () => {
    const keys = new Set<string>();

    collectTranslatorKeys(`translate("home.title"); translate('live2d.title');`, keys);

    expect(keys).toEqual(new Set(["home.title", "live2d.title"]));
  });

  it("collects every region key used by dynamic region translations", () => {
    const keys = new Set<string>();

    collectTranslatorKeys("translate(`region.${region}`);", keys);

    expect(keys).toEqual(
      new Set(["region.jp", "region.en", "region.tw", "region.kr", "region.cn"])
    );
  });

  it("keeps the story reader route vocabulary in its own namespace", async () => {
    const source = JSON.parse(
      await readFile(
        resolve(process.cwd(), "../../packages/i18n-source/media-lab-site/story-reader.json"),
        "utf8"
      )
    );

    expect(source).toMatchObject({
      "storyReader.meta.region": expect.any(String),
      "storyReader.meta.storyType": expect.any(String),
      "storyReader.meta.storyId": expect.any(String),
      "storyReader.status.title": expect.any(String),
      "storyReader.status.description": expect.any(String),
      "storyReader.storyType.area-talk": expect.any(String),
      "storyReader.storyType.profile": expect.any(String)
    });
  });

  it("keeps shell labels in common and track copy out of it", async () => {
    const common = JSON.parse(
      await readFile(
        resolve(process.cwd(), "../../packages/i18n-source/media-lab-site/common.json"),
        "utf8"
      )
    );
    const home = JSON.parse(
      await readFile(
        resolve(process.cwd(), "../../packages/i18n-source/media-lab-site/home.json"),
        "utf8"
      )
    );

    expect(common).toMatchObject({
      "navigation.live2d": "Live2D Studio",
      "navigation.assetViewer": "3D Asset Lab",
      "settings.primaryRegion": expect.any(String),
      "settings.secondaryRegion": expect.any(String),
      "errorPage.notFoundTitle": expect.any(String)
    });
    expect(common).not.toHaveProperty("home.title");
    expect(home).toMatchObject({
      "home.tracks.live2d.title": expect.any(String),
      "home.tracks.assetViewer.badge": expect.any(String)
    });
  });
});
