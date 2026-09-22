import { describe, expect, it, vi } from "vitest";
import {
  bondsHonorLocalAssetResources,
  buildHonorDegreeLayout,
  liveMasterLocalAssetResources
} from "@platform/ui-shell";
import { createHonorDegreeAssetResolver, toCatalogueHonorDegree } from "./honor-degree";
import type { Honor, HonorGroupMetadata } from "./domain/honor";

vi.mock("$env/dynamic/public", () => ({
  env: { PUBLIC_REMOTE_ASSET_BASE_URL: "https://assets.test" }
}));
const group: HonorGroupMetadata = {
  id: 1,
  name: null,
  honorType: "normal",
  backgroundAssetBundleName: "background",
  frameName: "frame"
};
const honor: Honor = {
  id: 1,
  name: null,
  assetBundleName: "master",
  group: null,
  groupId: 1,
  honorMissionType: null,
  honorRarity: "high",
  honorType: null,
  honorTypeId: null,
  seq: null,
  levels: [
    {
      level: 1,
      honorRarity: "low",
      assetBundleName: "level-low",
      honorId: 1,
      bonus: null,
      description: null
    },
    {
      level: 6,
      honorRarity: "high",
      assetBundleName: "level-high",
      honorId: 1,
      bonus: null,
      description: null
    }
  ]
};
const resolveAsset = createHonorDegreeAssetResolver("tw");

describe("catalogue honor adapter", () => {
  it("prefers the group background bundle for an ordinary honor core", () => {
    const degree = toCatalogueHonorDegree(honor, group);
    expect(degree.main).toMatchObject({ kind: "normal", assetBundleName: "background" });
    expect(
      buildHonorDegreeLayout(degree.main, resolveAsset).layers.find(
        (layer) => layer.name === "body"
      )?.href
    ).toBe("https://assets.test/sekai-tc-assets/honor/background/degree_main.webp");
  });
  it("uses the MasterHonor bundle for grouped event rank overlays while preserving background priority", () => {
    const degree = toCatalogueHonorDegree(honor, { ...group, honorType: "event" });
    for (const slot of ["main", "sub"] as const) {
      expect(degree[slot]).toMatchObject({
        kind: "normal",
        honorType: "event",
        assetBundleName: "background",
        rankAsset: { bundlePath: "honor/master", resourceName: `rank_${slot}.png` }
      });
      const layout = buildHonorDegreeLayout(
        degree[slot],
        resolveAsset,
        slot === "main" ? "main" : "sub1"
      );
      expect(layout.layers.find((layer) => layer.name === "body")?.href).toBe(
        `https://assets.test/sekai-tc-assets/honor/background/degree_${slot}.webp`
      );
      expect(layout.layers.find((layer) => layer.name === "rank")?.href).toBe(
        `https://assets.test/sekai-tc-assets/honor/master/rank_${slot}.webp`
      );
    }
  });
  it("treats event honors without a group background as regular honors", () => {
    const degree = toCatalogueHonorDegree(honor, {
      ...group,
      honorType: "event",
      backgroundAssetBundleName: null
    });

    for (const slot of ["main", "sub"] as const) {
      expect(degree[slot]).toMatchObject({
        kind: "normal",
        honorType: "regular",
        assetBundleName: "master",
        rankAsset: null
      });
      const layout = buildHonorDegreeLayout(
        degree[slot],
        resolveAsset,
        slot === "main" ? "main" : "sub1"
      );
      expect(layout.layers.find((layer) => layer.name === "body")?.href).toBe(
        `https://assets.test/sekai-tc-assets/honor/master/degree_${slot}.webp`
      );
      expect(layout.layers.some((layer) => layer.name === "rank")).toBe(false);
      expect(
        layout.layers.some(
          (layer) =>
            layer.name.startsWith("level-") || layer.name.startsWith("level-upgraded-")
        )
      ).toBe(true);
    }
  });
  it("does not treat event_point as an event rank overlay", () => {
    const degree = toCatalogueHonorDegree(honor, { ...group, honorType: "event_point" });
    for (const slot of ["main", "sub"] as const) {
      expect(degree[slot]).toMatchObject({
        kind: "normal",
        honorType: "regular",
        assetBundleName: "background",
        rankAsset: null
      });
      const layout = buildHonorDegreeLayout(
        degree[slot],
        resolveAsset,
        slot === "main" ? "main" : "sub1"
      );
      expect(layout.layers.some((layer) => layer.name === "rank")).toBe(false);
      expect(layout.layers.find((layer) => layer.name === "body")?.href).toBe(
        `https://assets.test/sekai-tc-assets/honor/background/degree_${slot}.webp`
      );
    }
  });
  it("does not use level bundles as the core for an ordinary honor without a master bundle", () => {
    const degree = toCatalogueHonorDegree(
      { ...honor, assetBundleName: null },
      { ...group, backgroundAssetBundleName: null, frameName: null }
    );
    expect(degree.main).toMatchObject({ kind: "normal", assetBundleName: null });
    const layers = buildHonorDegreeLayout(degree.main, resolveAsset).layers;
    expect(layers.some((layer) => layer.name === "body")).toBe(false);
    expect(
      layers.some(
        (layer) => layer.name.startsWith("level-") || layer.name.startsWith("level-upgraded-")
      )
    ).toBe(true);
  });
  it.each([
    "easy_full_combo",
    "normal_full_combo",
    "hard_full_combo",
    "expert_full_combo",
    "master_full_combo",
    "master_full_perfect",
    "append_full_combo",
    "append_full_perfect"
  ])("classifies the exact Live Master mission %s", (honorMissionType) => {
    const degree = toCatalogueHonorDegree(
      { ...honor, honorMissionType },
      { ...group, backgroundAssetBundleName: null }
    );

    expect(degree.main).toMatchObject({ kind: "normal", honorType: "live-master" });
    expect(degree.sub).toMatchObject({ kind: "normal", honorType: "live-master" });
    expect(degree.main).toMatchObject({ assetBundleName: "level-high" });
  });
  it("uses Live Master bundle priority: group background, selected level, then master", () => {
    const mission = { ...honor, honorMissionType: "master_full_combo" };
    const groupBackground = toCatalogueHonorDegree(mission, group);
    expect(groupBackground.main).toMatchObject({
      honorType: "live-master",
      assetBundleName: "background"
    });

    const selectedLevel = toCatalogueHonorDegree(mission, {
      ...group,
      backgroundAssetBundleName: "  "
    });
    expect(selectedLevel.main).toMatchObject({
      honorType: "live-master",
      assetBundleName: "level-high"
    });
    expect(
      buildHonorDegreeLayout(selectedLevel.main, resolveAsset).layers.find(
        (layer) => layer.name === "body"
      )?.href
    ).toBe("https://assets.test/sekai-tc-assets/honor/level-high/degree_main.webp");

    const masterFallback = toCatalogueHonorDegree(
      {
        ...mission,
        levels: honor.levels.map((level) => ({
          ...level,
          assetBundleName: level.level === 6 ? null : level.assetBundleName
        }))
      },
      { ...group, backgroundAssetBundleName: null }
    );
    expect(masterFallback.main).toMatchObject({
      honorType: "live-master",
      assetBundleName: "master"
    });
  });
  it("keeps non-Live-Master mission names on the ordinary honor path", () => {
    const degree = toCatalogueHonorDegree(
      { ...honor, honorMissionType: "master_full_combo_extra" },
      { ...group, backgroundAssetBundleName: null }
    );

    expect(degree.main).toMatchObject({
      kind: "normal",
      honorType: "regular",
      assetBundleName: "master"
    });
    expect(
      buildHonorDegreeLayout(degree.main, resolveAsset).layers.some((layer) =>
        layer.name.startsWith("level-")
      )
    ).toBe(true);
  });
  it("does not render an event honor without its master bundle even when group art exists", () => {
    const degree = toCatalogueHonorDegree(
      { ...honor, assetBundleName: null },
      { ...group, honorType: "event" }
    );
    expect(degree).toEqual({ main: { kind: "empty" }, sub: { kind: "empty" } });
  });
  it("selects a matching positive level and uses a safe local frame instead of a remote custom frame", () => {
    const degree = toCatalogueHonorDegree(honor, group);
    expect(degree.main).toMatchObject({ level: 6, rarity: 2 });
    const layers = buildHonorDegreeLayout(degree.main, resolveAsset).layers;
    expect(layers.find((layer) => layer.name === "frame")?.href).toBe(
      "/degree/frame_degree_m_3.png"
    );
    expect(layers.find((layer) => layer.name === "level-upgraded-0")?.href).toBe(
      "/degree/icon_degreeLv6.png"
    );
  });
  it.each(["normal", "event", "event_point", "birthday"])(
    "always selects generic m/s frames with normalized rarity for %s without frameName",
    (honorType) => {
      for (const [rarity, index] of ["low", "middle", "high", "highest"].map(
        (rarity, index) => [rarity, index] as const
      )) {
        const degree = toCatalogueHonorDegree(
          { ...honor, honorRarity: rarity },
          { ...group, honorType, frameName: null }
        );
        for (const slot of ["main", "sub1", "sub2"] as const) {
          const input = slot === "main" ? degree.main : degree.sub;
          expect(input).toMatchObject({ frameBundlePath: "local/honor", rarity: index });
          const layers = buildHonorDegreeLayout(input, resolveAsset, slot, "S").layers;
          expect(layers.slice(0, 2).map((layer) => layer.name)).toEqual(["body", "frame"]);
          expect(layers[1].href).toBe(
            `/degree/frame_degree_${slot === "main" ? "m" : "s"}_${index + 1}.png`
          );
        }
      }
    }
  );
  it("falls back to level rarity and then low rarity rather than omitting the frame", () => {
    const fromLevel = toCatalogueHonorDegree({ ...honor, honorRarity: null }, group);
    expect(fromLevel.main).toMatchObject({ rarity: 0, frameBundlePath: "local/honor" });
    const unknown = toCatalogueHonorDegree(
      { ...honor, honorRarity: "unknown", levels: [] },
      { ...group, frameName: null }
    );
    expect(unknown.main).toMatchObject({ rarity: 0, frameBundlePath: "local/honor" });
    expect(buildHonorDegreeLayout(unknown.main, resolveAsset).layers[1]?.href).toBe(
      "/degree/frame_degree_m_1.png"
    );
  });
  it("uses rank-match body, tier and local generic frame", () => {
    const degree = toCatalogueHonorDegree(honor, { ...group, honorType: "rank_match" });
    const layers = buildHonorDegreeLayout(degree.sub, resolveAsset, "sub1").layers;
    expect(layers.map((layer) => layer.href)).toEqual([
      "https://assets.test/sekai-tc-assets/rank_live/honor/background/degree_sub.webp",
      "/degree/frame_degree_s_3.png",
      "https://assets.test/sekai-tc-assets/rank_live/honor/master/sub.webp"
    ]);
  });
  it("uses birthday frame levels, suppresses invalid levels and keeps unknown types regular", () => {
    const birthday = toCatalogueHonorDegree(honor, { ...group, honorType: "birthday" });
    const birthdayLevels = buildHonorDegreeLayout(birthday.main, resolveAsset).layers.filter(
      (layer) => layer.name.startsWith("birthday-level-")
    );
    expect(birthdayLevels).toHaveLength(5);
    expect(birthdayLevels.every((layer) => layer.href === "/degree/frame_degree_level_3.png")).toBe(
      true
    );
    const invalid = toCatalogueHonorDegree(
      { ...honor, levels: honor.levels.map((level) => ({ ...level, level: 0 })) },
      { ...group, honorType: "future" }
    );
    expect(invalid.main).toMatchObject({ honorType: "regular", level: null });
    expect(buildHonorDegreeLayout(invalid.main, resolveAsset).layers).toHaveLength(2);
  });
  it("maps extensionless sprites and png resources without changing local formats", () => {
    expect(resolveAsset("local/honor", "icon_degreeLv")).toBe("/degree/icon_degreeLv.png");
    expect(resolveAsset("local/honor", "icon_degreeLv.png")).toBe("/degree/icon_degreeLv.png");
    expect(resolveAsset("unsupported", "body.png")).toBeNull();
  });
  it("maps verified Bonds and Live Master resources to their local asset paths", () => {
    const bondsResources = [
      bondsHonorLocalAssetResources.backgroundBase,
      bondsHonorLocalAssetResources.backgroundColor,
      bondsHonorLocalAssetResources.backgroundTextureMain,
      bondsHonorLocalAssetResources.backgroundTextureSub,
      bondsHonorLocalAssetResources.maskMain,
      bondsHonorLocalAssetResources.maskSub
    ];
    const liveMasterResources = [
      liveMasterLocalAssetResources.star1,
      liveMasterLocalAssetResources.star2
    ];

    for (const resource of bondsResources) {
      expect(resolveAsset(bondsHonorLocalAssetResources.bundlePath, resource)).toBe(
        `/degree/bonds/${resource}.png`
      );
    }
    for (const resource of liveMasterResources) {
      expect(resolveAsset(liveMasterLocalAssetResources.bundlePath, resource)).toBe(
        `/degree/live-master/${resource}.png`
      );
    }
  });
  it("does not infer Bonds selection or orientation from unrelated profile state", () => {
    const honorWithProfileState = {
      ...honor,
      profile: { selectedWord: "profile-value", orientation: "reverse" }
    };
    const degree = toCatalogueHonorDegree(honorWithProfileState, group);

    expect(degree.main).toMatchObject({ kind: "normal", honorType: "regular" });
    expect(degree.main).not.toHaveProperty("reverse");
    expect(degree.main).not.toHaveProperty("characters");
    expect(degree.main).not.toHaveProperty("word");
  });
});
