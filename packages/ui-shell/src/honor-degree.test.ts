import { render } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import HonorDegree from "./honor-degree.svelte";
import {
  bondsHonorLocalAssetResources,
  buildHonorDegreeLayout,
  getHonorDegreeLevelIconCounts,
  liveMasterLocalAssetResources,
  normalizeHonorDegreeRarity
} from "./honor-degree";
import type {
  HonorDegreeAssetResolver,
  HonorDegreeInput,
  HonorDegreeSlot
} from "./honor-degree.types";

const resolveAsset: HonorDegreeAssetResolver = (bundle, resource) => `/${bundle}/${resource}`;
const normal = {
  kind: "normal",
  assetBundleName: "achievement",
  group: { frameName: "standard" },
  rarity: "high",
  level: 7
} satisfies HonorDegreeInput;

describe("HonorDegree", () => {
  it.each<HonorDegreeSlot>(["main", "sub1", "sub2"])(
    "uses independent %s geometry and resources",
    (slot) => {
      const { getByRole, container } = render(HonorDegree, {
        honor: normal,
        resolveAsset,
        slot,
        label: "Achievement"
      });
      const main = slot === "main";
      expect(getByRole("img", { name: "Achievement" }).getAttribute("viewBox")).toBe(
        `0 0 ${main ? 380 : 180} 80`
      );
      const images = [...container.querySelectorAll("image")];
      expect(images.map((image) => image.getAttribute("data-layer"))).toEqual([
        "body",
        "frame",
        "level-0",
        "level-1",
        "level-2",
        "level-3",
        "level-4",
        "level-upgraded-0",
        "level-upgraded-1"
      ]);
      expect(images.map((image) => image.getAttribute("href"))).toEqual([
        `/honor/achievement/degree_${main ? "main" : "sub"}.png`,
        `/local/honor/frame_degree_${main ? "m" : "s"}_3`,
        ...Array.from({ length: 5 }, () => "/local/honor/icon_degreeLv"),
        ...Array.from({ length: 2 }, () => "/local/honor/icon_degreeLv6")
      ]);
      expect(
        images
          .slice(0, 2)
          .map((image) => [
            image.getAttribute("x"),
            image.getAttribute("y"),
            image.getAttribute("width"),
            image.getAttribute("height")
          ])
      ).toEqual(Array.from({ length: 2 }, () => ["0", "0", main ? "380" : "180", "80"]));
      expect(images.slice(2, 7).map((image) => image.getAttribute("x"))).toEqual(
        Array.from({ length: 5 }, (_, i) => String(51 + 16 * i))
      );
      expect(images.slice(7).map((image) => image.getAttribute("x"))).toEqual(["51", "67"]);
      expect(
        images
          .slice(2)
          .every(
            (image) =>
              image.getAttribute("y") === "64" &&
              image.getAttribute("width") === "16" &&
              image.getAttribute("height") === "16"
          )
      ).toBe(true);
    }
  );

  it.each<HonorDegreeSlot>(["main", "sub1"])(
    "uses a local default frame for %s despite group frameName",
    (slot) => {
      const { container } = render(HonorDegree, {
        honor: {
          kind: "normal",
          group: { frameName: "remote-theme" },
          rarity: "high"
        },
        resolveAsset,
        slot
      });
      const frame = container.querySelector('[data-layer="frame"]');
      expect(frame?.getAttribute("href")).toBe(
        `/local/honor/frame_degree_${slot === "main" ? "m" : "s"}_3`
      );
    }
  );

  it.each<HonorDegreeSlot>(["main", "sub1", "sub2"])(
    "renders event ranks without levels for %s",
    (slot) => {
      const { container } = render(HonorDegree, {
        honor: {
          ...normal,
          honorType: "event",
          rankAsset: { bundlePath: "honor/ranking", resourceName: "rank.png" }
        },
        resolveAsset,
        slot
      });
      expect(
        [...container.querySelectorAll("image")].map((image) => image.getAttribute("data-layer"))
      ).toEqual(["body", "frame", "rank"]);
      const rank = container.querySelector('[data-layer="rank"]');
      expect(["x", "y", "width", "height"].map((key) => rank?.getAttribute(key))).toEqual(
        slot === "main" ? ["190", "1", "150", "78"] : ["60", "0", "120", "38"]
      );
    }
  );

  it.each([
    ["main", "rank_main.png"],
    ["sub1", "rank_sub.png"]
  ] as const)("renders World Link chapter ranks full-root in %s", (slot, resourceName) => {
    const main = slot === "main";
    const layout = buildHonorDegreeLayout(
      {
        ...normal,
        honorType: "event",
        assetBundleName: "honor_top_123456_event_123_cp2",
        rankAsset: {
          bundlePath: "honor/honor_top_123456_event_123_cp2",
          resourceName
        }
      },
      resolveAsset,
      slot
    );

    expect(layout.layers.map((layer) => layer.name)).toEqual(["body", "frame", "rank"]);
    expect(
      layout.layers.slice(0, 2).map(({ x, y, width, height }) => ({ x, y, width, height }))
    ).toEqual(
      Array.from({ length: 2 }, () => ({ x: 0, y: 0, width: main ? 380 : 180, height: 80 }))
    );
    expect(layout.layers[1]?.href).toBe(`/honor_frame/standard/frame_degree_${main ? "m" : "s"}_3`);
    expect(layout.layers[2]).toMatchObject({
      href: `/honor/honor_top_123456_event_123_cp2/${resourceName}`,
      x: 0,
      y: 0,
      width: main ? 380 : 180,
      height: 80
    });
  });

  it("keeps standard World Link event honors on the ordinary rank template", () => {
    const layout = buildHonorDegreeLayout(
      {
        ...normal,
        honorType: "event",
        assetBundleName: "honor_top_000001",
        rankAsset: { bundlePath: "honor/honor_top_000001", resourceName: "rank_sub.png" }
      },
      resolveAsset,
      "sub1"
    );

    expect(layout.layers[2]).toMatchObject({
      x: 60,
      y: 0,
      width: 120,
      height: 38
    });
  });

  it.each([
    ["low", 0, "local/honor"],
    ["middle", 1, "local/honor"],
    ["high", 2, "honor_frame/world-link"],
    ["highest", 3, "honor_frame/world-link"]
  ] as const)("selects chapter %s frame from its bundle", (rarity, suffix, bundle) => {
    const layout = buildHonorDegreeLayout(
      {
        ...normal,
        honorType: "regular",
        assetBundleName: "honor_top_000001_event_123_cp2",
        group: { frameName: "world-link" },
        rarity
      },
      resolveAsset
    );
    expect(layout.layers[1]?.href).toBe(`/${bundle}/frame_degree_m_${suffix + 1}`);
  });

  it("does not invent a missing event rank or show an event rank for regular honors", () => {
    expect(
      buildHonorDegreeLayout({ ...normal, honorType: "event" }, resolveAsset).layers.map(
        (layer) => layer.name
      )
    ).toEqual(["body", "frame"]);
    expect(
      buildHonorDegreeLayout(
        { ...normal, rankAsset: { bundlePath: "rank", resourceName: "rank" } },
        resolveAsset
      ).layers.some((layer) => layer.name === "rank")
    ).toBe(false);
  });

  it.each<HonorDegreeSlot>(["main", "sub1"])(
    "renders bounded birthday copies at %s coordinates",
    (slot) => {
      const { container } = render(HonorDegree, {
        honor: { ...normal, honorType: "birthday", level: 99 },
        resolveAsset,
        slot
      });
      const copies = [...container.querySelectorAll('image[data-layer^="birthday-level-"]')];
      expect(copies).toHaveLength(5);
      copies.forEach((copy, i) => {
        expect(copy.getAttribute("href")).toBe("/honor_frame/standard/frame_degree_level_3");
        expect(copy.getAttribute("x")).toBe(String((slot === "main" ? 150 : 50) + i * 16));
        expect(copy.getAttribute("y")).toBe("64");
        expect(copy.getAttribute("width")).toBe("16");
        expect(copy.getAttribute("height")).toBe("16");
      });
      expect(container.querySelector('[data-layer="level-0"]')).toBeNull();
    }
  );

  it("resolves birthday level sprites from the group frame", () => {
    const layout = buildHonorDegreeLayout(
      {
        ...normal,
        honorType: "birthday",
        frameBundlePath: "local/honor"
      },
      resolveAsset
    );

    expect(layout.layers.find((layer) => layer.name === "frame")?.href).toBe(
      "/honor_frame/standard/frame_degree_m_3"
    );
    expect(layout.layers.find((layer) => layer.name === "birthday-level-0")?.href).toBe(
      "/honor_frame/standard/frame_degree_level_3"
    );
  });

  it.each([
    ["low", 0, "honor_frame/standard"],
    ["middle", 1, "honor_frame/standard"],
    ["high", 2, "honor_frame/standard"],
    ["highest", 3, "honor_frame/standard"]
  ] as const)("uses Birthday %s frame and level resources", (rarity, suffix, bundle) => {
    const layout = buildHonorDegreeLayout(
      {
        ...normal,
        honorType: "birthday",
        rarity,
        frameBundlePath: "local/honor"
      },
      resolveAsset
    );

    expect(layout.layers.find((layer) => layer.name === "frame")?.href).toBe(
      `/${bundle}/frame_degree_m_${suffix + 1}`
    );
    expect(layout.layers.find((layer) => layer.name === "birthday-level-0")?.href).toBe(
      `/honor_frame/standard/frame_degree_level_${suffix + 1}`
    );
    expect(layout.layers.some((layer) => layer.name === "rank")).toBe(false);
  });

  it("uses the effective frame bundle for birthday level sprites when no group frameName exists", () => {
    const layout = buildHonorDegreeLayout(
      {
        kind: "normal",
        honorType: "birthday",
        frameBundlePath: "local/honor",
        rarity: "low",
        level: 1
      },
      resolveAsset
    );

    expect(layout.layers.find((layer) => layer.name === "frame")?.href).toBe(
      "/local/honor/frame_degree_m_1"
    );
    expect(layout.layers.find((layer) => layer.name === "birthday-level-0")?.href).toBe(
      "/local/honor/frame_degree_level_1"
    );
  });

  it.each<HonorDegreeSlot>(["main", "sub1"])(
    "renders rank-match body, frame, and tier for %s",
    (slot) => {
      const layout = buildHonorDegreeLayout(
        {
          kind: "rank-match",
          assetBundleName: "tier",
          backgroundAssetBundleName: "season",
          rarity: "high",
          frameBundlePath: "degree"
        },
        resolveAsset,
        slot
      );
      expect(layout.layers.map((layer) => layer.name)).toEqual(["body", "frame", "rank"]);
      expect(layout.layers.map((layer) => layer.href)).toEqual([
        `/rank_live/honor/season/degree_${slot === "main" ? "main" : "sub"}.png`,
        `/degree/frame_degree_${slot === "main" ? "m" : "s"}_3`,
        `/rank_live/honor/tier/${slot === "main" ? "main" : "sub"}.png`
      ]);
      expect(layout.layers[2]).toMatchObject(
        slot === "main"
          ? { x: 200, y: 1, width: 180, height: 78 }
          : { x: 11, y: 0, width: 158, height: 40 }
      );
      expect(
        buildHonorDegreeLayout({ kind: "rank-match", assetBundleName: "tier" }, resolveAsset)
          .layers[0]?.href
      ).toBe("/rank_live/honor/tier/degree_main.png");
    }
  );

  it("omits a rank-match frame when its rarity or frame bundle is unavailable", () => {
    expect(
      buildHonorDegreeLayout(
        { kind: "rank-match", assetBundleName: "tier", rarity: "high" },
        resolveAsset
      ).layers.map((layer) => layer.name)
    ).toEqual(["body", "rank"]);
    expect(
      buildHonorDegreeLayout(
        { kind: "rank-match", assetBundleName: "tier", frameBundlePath: "degree" },
        resolveAsset
      ).layers.map((layer) => layer.name)
    ).toEqual(["body", "rank"]);
    expect(
      buildHonorDegreeLayout(
        {
          kind: "rank-match",
          assetBundleName: "tier",
          rarity: "high",
          frameBundlePath: "degree"
        },
        (bundle, resource) =>
          resource.startsWith("frame_degree") ? null : resolveAsset(bundle, resource)
      ).layers.map((layer) => layer.name)
    ).toEqual(["body", "rank"]);
  });

  it.each([1, 5, 6, 10, 11, 20, 21])(
    "cycles regular and upgraded level icons for level %i",
    (level) => {
      const icons = buildHonorDegreeLayout({ kind: "normal", level }, resolveAsset).layers;
      const counts = getHonorDegreeLevelIconCounts(level);
      expect(counts).not.toBeNull();
      expect(icons).toHaveLength((counts?.regular ?? 0) + (counts?.upgraded ?? 0));
      expect(icons.filter((icon) => icon.href.endsWith("icon_degreeLv6"))).toHaveLength(
        counts?.upgraded ?? 0
      );
      expect(icons.filter((icon) => icon.href.endsWith("icon_degreeLv"))).toHaveLength(
        counts?.regular ?? 0
      );
    }
  );

  it.each([0, -1, 1.5, NaN, Infinity, null])("suppresses invalid level %s", (level) => {
    expect(buildHonorDegreeLayout({ kind: "normal", level }, resolveAsset).layers).toEqual([]);
  });

  it("normalizes rarity safely without defaulting unavailable frames", () => {
    expect(
      ["low", "middle", "high", "highest", 0, 1, 2, 3].map(normalizeHonorDegreeRarity)
    ).toEqual([0, 1, 2, 3, 0, 1, 2, 3]);
    expect([null, undefined, "unknown", "1", -1, 4, NaN].map(normalizeHonorDegreeRarity)).toEqual(
      Array(7).fill(null)
    );
    expect(
      buildHonorDegreeLayout(
        { ...normal, rarity: null, honorType: "birthday" },
        resolveAsset
      ).layers.map((layer) => layer.name)
    ).toEqual(["body"]);
  });

  it("renders supplied bonds layers only and reverses the independent sub root", () => {
    const asset = (resourceName: string) => ({ bundlePath: "bonds", resourceName });
    const part = { ...asset("character"), x: 5, y: 0, width: 80, height: 80 };
    const { container, getByRole } = render(HonorDegree, {
      honor: {
        kind: "bonds",
        reverse: true,
        rarity: "high",
        background: asset("background"),
        pattern: asset("pattern"),
        characters: [part, null],
        word: { ...part, resourceName: "word" }
      },
      resolveAsset,
      slot: "sub2"
    });
    expect(getByRole("img").getAttribute("viewBox")).toBe("0 0 180 80");
    expect(container.querySelector("g")?.getAttribute("transform")).toBe(
      "translate(180,0) scale(-1,1)"
    );
    expect(
      [...container.querySelectorAll("image")].map((image) => image.getAttribute("data-layer"))
    ).toEqual(["body", "pattern", "character-0", "frame", "word"]);
    expect(container.querySelector('[data-layer="body"]')?.getAttribute("href")).toBe(
      "/bonds/background"
    );
    expect(container.querySelector('[data-layer="frame"]')?.getAttribute("href")).toBe(
      "/local/honor/frame_degree_s_3"
    );
    const frame = container.querySelector('[data-layer="frame"]');
    expect(["x", "y", "width", "height"].map((key) => frame?.getAttribute(key))).toEqual([
      "0",
      "0",
      "180",
      "80"
    ]);
  });

  it("exports only the verified local Bonds and Live Master resource names", () => {
    expect(bondsHonorLocalAssetResources).toEqual({
      bundlePath: "local/bonds-honor",
      backgroundBase: "degree_bgBase",
      backgroundColor: "degree_bgColor",
      backgroundTextureMain: "degree_bgTexture_main",
      backgroundTextureSub: "degree_bgTexture_sub",
      maskMain: "mask_degree_main",
      maskSub: "mask_degree_sub"
    });
    expect(liveMasterLocalAssetResources).toEqual({
      bundlePath: "local/live-master",
      star1: "live_master_honor_star_1",
      star2: "live_master_honor_star_2"
    });
  });

  it("paints ordered Bonds backgrounds before pattern, characters, frame, and word", () => {
    const asset = (resourceName: string, bundlePath = "bonds") => ({
      bundlePath,
      resourceName
    });
    const part = (resourceName: string) => ({
      ...asset(resourceName),
      x: 4,
      y: 2,
      width: 30,
      height: 40
    });
    const layout = buildHonorDegreeLayout(
      {
        kind: "bonds",
        backgrounds: [
          asset(
            bondsHonorLocalAssetResources.backgroundBase,
            bondsHonorLocalAssetResources.bundlePath
          ),
          asset(
            bondsHonorLocalAssetResources.backgroundColor,
            bondsHonorLocalAssetResources.bundlePath
          )
        ],
        pattern: asset("pattern"),
        characters: [part("character-main"), part("character-sub")],
        rarity: "middle",
        word: part("word")
      },
      resolveAsset
    );

    expect(layout.layers.map((layer) => layer.name)).toEqual([
      "background-0",
      "background-1",
      "pattern",
      "character-0",
      "character-1",
      "frame",
      "word"
    ]);
    expect(layout.layers.map((layer) => layer.href)).toEqual([
      `/local/bonds-honor/${bondsHonorLocalAssetResources.backgroundBase}`,
      `/local/bonds-honor/${bondsHonorLocalAssetResources.backgroundColor}`,
      "/bonds/pattern",
      "/bonds/character-main",
      "/bonds/character-sub",
      "/local/honor/frame_degree_m_2",
      "/bonds/word"
    ]);
  });

  it("renders caller-specified character masks with unique IDs inside the mirrored root", () => {
    const character = {
      bundlePath: "bonds",
      resourceName: "character",
      x: 24,
      y: 3,
      width: 70,
      height: 74,
      mask: {
        bundlePath: bondsHonorLocalAssetResources.bundlePath,
        resourceName: bondsHonorLocalAssetResources.maskMain,
        x: 20,
        y: 1,
        width: 76,
        height: 78
      }
    };
    const props = {
      honor: { kind: "bonds", reverse: true, characters: [character, null] },
      resolveAsset
    } as const;
    const first = render(HonorDegree, props);
    const second = render(HonorDegree, props);
    const firstMask = first.container.querySelector("mask");
    const characterImage = first.container.querySelector('[data-layer="character-0"]');
    const rootGroup = first.container.querySelector("g");

    expect(firstMask?.getAttribute("mask-type")).toBe("alpha");
    expect(firstMask?.getAttribute("maskUnits")).toBe("userSpaceOnUse");
    expect(firstMask?.getAttribute("maskContentUnits")).toBe("userSpaceOnUse");
    expect(
      ["x", "y", "width", "height"].map((attribute) => firstMask?.getAttribute(attribute))
    ).toEqual(["20", "1", "76", "78"]);
    expect(firstMask?.querySelector("image")?.getAttribute("href")).toBe(
      `/local/bonds-honor/${bondsHonorLocalAssetResources.maskMain}`
    );
    expect(characterImage?.getAttribute("mask")).toBe(`url(#${firstMask?.id})`);
    expect(firstMask?.closest("g")).toBe(rootGroup);
    expect(rootGroup?.getAttribute("transform")).toBe("translate(380,0) scale(-1,1)");
    expect(second.container.querySelector("mask")?.id).not.toBe(firstMask?.id);
  });

  it("omits absent and unresolved Bonds layers and masks", () => {
    expect(buildHonorDegreeLayout({ kind: "bonds" }, resolveAsset).layers).toEqual([]);

    const character = {
      bundlePath: "bonds",
      resourceName: "character",
      x: 0,
      y: 0,
      width: 80,
      height: 80,
      mask: {
        bundlePath: "bonds",
        resourceName: "unresolved-mask",
        x: 0,
        y: 0,
        width: 80,
        height: 80
      }
    };
    const layout = buildHonorDegreeLayout(
      { kind: "bonds", characters: [character, null] },
      (_bundle, resource) => (resource === "character" ? "/character.png" : null)
    );

    expect(layout.layers).toEqual([
      {
        name: "character-0",
        href: "/character.png",
        x: 0,
        y: 0,
        width: 80,
        height: 80
      }
    ]);
  });

  it("draws valid live-master parts last and omits unresolved assets", () => {
    const part = { bundlePath: "live", resourceName: "part", x: 0, y: 0, width: 30, height: 20 };
    const layout = buildHonorDegreeLayout(
      { ...normal, honorType: "live-master", liveMasterParts: [part, { ...part, width: NaN }] },
      (bundle, resource) =>
        bundle.startsWith("honor_frame") ? null : resolveAsset(bundle, resource)
    );
    expect(layout.layers.at(-1)).toMatchObject({ name: "live-master-0", href: "/live/part" });
    expect(layout.layers.find((layer) => layer.name === "frame")?.href).toBe(
      "/local/honor/frame_degree_m_3"
    );
    expect(layout.layers.some((layer) => layer.name === "live-master-1")).toBe(false);
  });

  it.each<HonorDegreeSlot>(["main", "sub1"])(
    "uses the local normalized frame before Live Master parts in %s despite group frameName",
    (slot) => {
      const layout = buildHonorDegreeLayout(
        {
          ...normal,
          assetBundleName: "honor_top_000001",
          group: { frameName: "remote-theme" },
          honorType: "live-master",
          rarity: "high",
          liveMasterParts: [
            {
              bundlePath: liveMasterLocalAssetResources.bundlePath,
              resourceName: liveMasterLocalAssetResources.star1,
              x: 10,
              y: 5,
              width: 20,
              height: 20
            }
          ]
        },
        resolveAsset,
        slot
      );
      const main = slot === "main";

      expect(layout.layers.map((layer) => layer.name)).toEqual(["body", "frame", "live-master-0"]);
      expect(layout.layers[1]?.href).toBe(`/local/honor/frame_degree_${main ? "m" : "s"}_3`);
      expect(layout.layers[2]?.href).toBe(
        `/local/live-master/${liveMasterLocalAssetResources.star1}`
      );
    }
  );

  it("does not add generic level icons to Live Master honors", () => {
    const layers = buildHonorDegreeLayout(
      { ...normal, honorType: "live-master" },
      resolveAsset
    ).layers;

    expect(layers.map((layer) => layer.name)).toEqual(["body", "frame"]);
    expect(
      layers.some(
        (layer) => layer.name.startsWith("level-") || layer.name.startsWith("level-upgraded-")
      )
    ).toBe(false);
  });

  it("renders explicitly supplied local Live Master star parts in caller order", () => {
    const part = (resourceName: string, x: number) => ({
      bundlePath: liveMasterLocalAssetResources.bundlePath,
      resourceName,
      x,
      y: 5,
      width: 20,
      height: 20
    });
    const layout = buildHonorDegreeLayout(
      {
        kind: "normal",
        honorType: "live-master",
        liveMasterParts: [
          part(liveMasterLocalAssetResources.star1, 10),
          part(liveMasterLocalAssetResources.star2, 30)
        ]
      },
      resolveAsset
    );

    expect(layout.layers.map((layer) => layer.name)).toEqual(["live-master-0", "live-master-1"]);
    expect(layout.layers.map((layer) => layer.href)).toEqual([
      `/local/live-master/${liveMasterLocalAssetResources.star1}`,
      `/local/live-master/${liveMasterLocalAssetResources.star2}`
    ]);
  });

  it.each([
    ["S", 0.7],
    ["M", 0.8],
    ["L", 1],
    ["LL", 1.2]
  ] as const)("scales %s without changing the root", (size, scale) => {
    const { getByRole } = render(HonorDegree, { honor: normal, resolveAsset, size });
    const svg = getByRole("img");
    expect(svg.getAttribute("viewBox")).toBe("0 0 380 80");
    expect(svg.style.width).toBe(`${380 * scale}px`);
    expect(svg.style.height).toBe(`${80 * scale}px`);
  });

  it("provides accessible empty, unavailable, and decorative states and reacts to updates", async () => {
    const resolver = vi.fn<HonorDegreeAssetResolver>(() => null);
    const { container, getByRole, queryByRole, rerender } = render(HonorDegree, {
      honor: null,
      resolveAsset: resolver,
      slot: "sub1",
      label: "No honor",
      title: "Empty slot"
    });
    expect(getByRole("img", { name: "No honor" }).getAttribute("viewBox")).toBe("0 0 180 80");
    expect(container.querySelector("text")?.textContent).toBe("No honor");
    expect(container.querySelector("title")?.textContent).toBe("Empty slot");
    expect(resolver).not.toHaveBeenCalled();
    await rerender({ honor: normal });
    expect(container.querySelector("image")).toBeNull();
    await rerender({ resolveAsset, decorative: true });
    expect(container.querySelector("image")).not.toBeNull();
    expect(queryByRole("img")).toBeNull();
    expect(container.querySelector("title")).toBeNull();
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("keeps an empty small sub slot at 126x56 CSS pixels", () => {
    const { getByRole, container } = render(HonorDegree, {
      honor: { kind: "empty" },
      resolveAsset,
      slot: "sub2",
      size: "S"
    });
    expect(getByRole("img", { name: "Honor" }).style.width).toBe("126px");
    expect(getByRole("img").style.height).toBe("56px");
    expect(container.querySelector("text")?.textContent).toBe("Honor");
  });
});
