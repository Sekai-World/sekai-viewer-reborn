import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { collectTranslatorKeys } from "./tools-site-source.mjs";

describe("tools-site i18n source collection", () => {
  it("collects literal keys from both t and translate calls", () => {
    const keys = new Set<string>();

    collectTranslatorKeys(
      `t("home.title"); translate('home.noEvent'); translate(\`dynamic.key\`);`,
      keys
    );

    expect(keys).toEqual(new Set(["home.title", "home.noEvent"]));
  });

  it("collects every region key used by dynamic region translations", () => {
    const keys = new Set<string>();

    collectTranslatorKeys("translate(`region.${region}`);", keys);

    expect(keys).toEqual(
      new Set(["region.jp", "region.en", "region.tw", "region.kr", "region.cn"])
    );
  });

  it("keeps distinct time-travel failure messages in the tracker source", async () => {
    const source = JSON.parse(
      await readFile(resolve(process.cwd(), "../../packages/i18n-source/tools-site/tracker.json"), "utf8")
    );

    expect(source).toMatchObject({
      "tracker.timePointUnavailable": expect.any(String),
      "tracker.timePointError.sdk-error": expect.any(String),
      "tracker.timePointError.network-error": expect.any(String),
      "tracker.timePointError.invalid-data": expect.any(String),
      "tracker.snapshotUnavailable": expect.any(String),
      "tracker.snapshotError.sdk-error": expect.any(String),
      "tracker.snapshotError.network-error": expect.any(String),
      "tracker.snapshotError.invalid-data": expect.any(String)
    });
  });

  it("uses the approved past-rankings labels without obsolete snapshot controls", async () => {
    const source = JSON.parse(
      await readFile(resolve(process.cwd(), "../../packages/i18n-source/tools-site/tracker.json"), "utf8")
    );
    expect(source).toMatchObject({ "tracker.goToCurrentEvent": "Go to current event" });
    expect(source).not.toHaveProperty("tracker.rankCount");
    expect(source).not.toHaveProperty("tracker.viewRankingHistory");

    expect(source).toMatchObject({
      "tracker.viewPastRankings": "View past rankings",
      "tracker.backToLatestRankings": "Back to latest rankings",
      "tracker.pastRankings": "Past rankings"
    });
    expect(source).not.toHaveProperty("tracker.browseSavedSnapshots");
    expect(source).not.toHaveProperty("tracker.closeSnapshots");
    expect(source).toMatchObject({ "tracker.latest": "Latest" });
    expect(source).not.toHaveProperty("tracker.timeTravelControls");
  });
});
