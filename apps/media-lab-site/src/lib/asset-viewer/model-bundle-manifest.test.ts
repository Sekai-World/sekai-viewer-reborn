import { describe, expect, it } from "vitest";
import {
  MODEL_BUNDLE_INDEX_PATH,
  isManifestPath,
  modelBundleFilePath,
  modelBundleManifestPath,
  parseModelBundleIndex,
  parseModelBundleManifest,
  type ModelBundleIndex,
  type ModelBundleManifest
} from "./model-bundle-manifest";

const TYPE_TREE = "unity-typetree-json" as const;

// The file names are those published for this bundle in the JP bucket on 2026-08-31; the rig and
// source values are stand-ins for what the exporter would write.
const bodyManifest = (): ModelBundleManifest => ({
  schemaVersion: 1,
  region: "jp",
  bundlePath: "live_pv/model/characterv2/body/01/0001/ladies_m",
  model: { path: "fbx/model.fbx", format: "fbx-ascii" },
  textures: [
    "fbx/tex_bdy_KEI_A_00_C.png",
    "fbx/tex_bdy_KEI_A_00_H.png",
    "fbx/tex_bdy_KEI_A_00_S.png"
  ],
  avatars: [{ path: "fbx/mdl_bdy_kei_a_00.fbx", format: TYPE_TREE }],
  materials: [{ path: "fbx/materials/mtl_bdy_00.mat", format: TYPE_TREE }],
  prefabs: [
    { path: "body.prefab", format: TYPE_TREE },
    { path: "guitar_body.prefab", format: TYPE_TREE },
    { path: "sit_body.prefab", format: TYPE_TREE }
  ],
  rig: { boneNames: ["Position", "Hip", "Waist"], blendShapeNames: [] },
  source: { unityVersion: "2022.3.21f1", dependencies: ["live_pv/model/characterv2/shader"] }
});

const motionIndex = (): ModelBundleIndex => ({
  schemaVersion: 1,
  region: "jp",
  generatedAt: "2026-11-15T00:00:00Z",
  models: [{ bundlePath: "live_pv/model/characterv2/body/01/0001/ladies_m" }],
  animations: [
    {
      bundlePath: "model3d/motion/common/default",
      clips: [
        { name: "blink", path: "blink.anim", format: TYPE_TREE },
        { name: "breath_loop", path: "breath_loop.anim", format: TYPE_TREE }
      ]
    }
  ]
});

const issuesOf = (result: { ok: true } | { ok: false; issues: string[] }): string[] =>
  result.ok ? [] : result.issues;

const manifestIssues = (change: (manifest: Record<string, unknown>) => void): string[] => {
  const manifest = bodyManifest() as unknown as Record<string, unknown>;
  change(manifest);
  return issuesOf(parseModelBundleManifest(manifest));
};

const indexIssues = (change: (index: Record<string, unknown>) => void): string[] => {
  const index = motionIndex() as unknown as Record<string, unknown>;
  change(index);
  return issuesOf(parseModelBundleIndex(index));
};

describe("isManifestPath", () => {
  it("accepts relative paths of plain segments", () => {
    for (const path of [
      "fbx/model.fbx",
      "body.prefab",
      "live_pv/model/character/body/01",
      "fbx/tex bdy (1).png"
    ]) {
      expect(isManifestPath(path), path).toBe(true);
    }
  });

  it("rejects paths that could leave the bundle or change the request", () => {
    for (const path of [
      "",
      "/fbx/model.fbx",
      "fbx/",
      "fbx//model.fbx",
      "../model.fbx",
      "fbx/../../model.fbx",
      "./fbx/model.fbx",
      "fbx\\model.fbx",
      "fbx/mo\ndel.fbx",
      "fbx/mo\u007fdel.fbx",
      "a/%2e%2e/b",
      "fbx/model.fbx?x",
      "fbx/model.fbx#y",
      " fbx/model.fbx",
      "fbx /model.fbx",
      "a".repeat(1025),
      7,
      null
    ]) {
      expect(isManifestPath(path), JSON.stringify(path)).toBe(false);
    }
  });
});

describe("parseModelBundleManifest", () => {
  it("accepts the representative body bundle and returns it", () => {
    const manifest = bodyManifest();

    expect(parseModelBundleManifest(manifest)).toEqual({ ok: true, value: manifest });
  });

  it("accepts a bundle without rig and source facts, and ignores unknown fields", () => {
    expect(
      manifestIssues((manifest) => {
        delete manifest.rig;
        delete manifest.source;
        manifest.futureField = { anything: true };
      })
    ).toEqual([]);
  });

  it("rejects anything that is not an object", () => {
    for (const value of [null, undefined, "manifest", 1, []]) {
      expect(parseModelBundleManifest(value)).toEqual({
        ok: false,
        issues: ["manifest: must be an object"]
      });
    }
  });

  it("requires schema version 1 and a known region", () => {
    for (const schemaVersion of [0, 2, "1"]) {
      expect(manifestIssues((manifest) => (manifest.schemaVersion = schemaVersion))).toEqual([
        "schemaVersion: must be 1"
      ]);
    }
    expect(manifestIssues((manifest) => (manifest.region = "us"))).toEqual([
      "region: is not a known region"
    ]);
  });

  it("requires the fixed model path, so a flat or renamed export is refused", () => {
    for (const path of ["model.fbx", "fbx/mdl_bdy_kei_a_00.fbx", "fbx/model.glb"]) {
      expect(
        manifestIssues((manifest) => (manifest.model = { path, format: "fbx-ascii" }))
      ).toEqual(['model.path: must be "fbx/model.fbx"']);
    }
    expect(
      manifestIssues((manifest) => (manifest.model = { path: "fbx/model.fbx", format: "glb" }))
    ).toEqual(['model.format: must be "fbx-ascii"']);
    for (const model of [undefined, null, "fbx/model.fbx"]) {
      expect(manifestIssues((manifest) => (manifest.model = model))).toEqual([
        "model: must be an object"
      ]);
    }
  });

  it("does not let the model export or the manifest be listed as a type tree file", () => {
    expect(
      manifestIssues(
        (manifest) => (manifest.avatars = [{ path: "fbx/model.fbx", format: TYPE_TREE }])
      )
    ).toEqual(["avatars[0].path: is the model export, not a type tree file"]);
    expect(
      manifestIssues(
        (manifest) => (manifest.materials = [{ path: "fbx/manifest.json", format: TYPE_TREE }])
      )
    ).toEqual(["materials[0].path: is the manifest itself"]);
    expect(
      manifestIssues(
        (manifest) =>
          (manifest.avatars = [{ path: "fbx/mdl_bdy_kei_a_00.fbx", format: "fbx-ascii" }])
      )
    ).toEqual(['avatars[0].format: must be "unity-typetree-json"']);
  });

  it("lists only the PNG files directly in fbx/ as textures", () => {
    for (const path of ["sourceimages/tex_c.png", "fbx/tex.webp", "fbx/materials/tex.png"]) {
      expect(manifestIssues((manifest) => (manifest.textures = [path]))).toEqual([
        "textures[0]: must be a PNG file in fbx/"
      ]);
    }
  });

  it("gives a file one role only, within a list and across the lists", () => {
    expect(
      manifestIssues((manifest) => (manifest.textures = ["fbx/a.png", "fbx/b.png", "fbx/a.png"]))
    ).toEqual(["textures[2]: is listed twice"]);
    expect(
      manifestIssues(
        (manifest) => (manifest.prefabs = [{ path: "fbx/mdl_bdy_kei_a_00.fbx", format: TYPE_TREE }])
      )
    ).toEqual(["prefabs[0].path: is listed twice"]);
    expect(
      manifestIssues(
        (manifest) =>
          (manifest.materials = [{ path: "fbx/tex_bdy_KEI_A_00_C.png", format: TYPE_TREE }])
      )
    ).toEqual(["materials[0].path: is listed twice"]);
  });

  it("reports every list that is missing", () => {
    expect(
      manifestIssues((manifest) => {
        delete manifest.textures;
        delete manifest.avatars;
        delete manifest.materials;
        delete manifest.prefabs;
      })
    ).toEqual([
      "textures: must be a list",
      "avatars: must be a list",
      "materials: must be a list",
      "prefabs: must be a list"
    ]);
  });

  it("checks paths that would leave the bundle", () => {
    expect(manifestIssues((manifest) => (manifest.bundlePath = "/live_pv/model"))).toEqual([
      "bundlePath: must be a relative path"
    ]);
    expect(
      manifestIssues(
        (manifest) => (manifest.prefabs = [{ path: "../body.prefab", format: TYPE_TREE }, "x"])
      )
    ).toEqual(["prefabs[0].path: must be a relative path", "prefabs[1]: must be an object"]);
  });

  it("checks the rig and source facts when they are given", () => {
    expect(manifestIssues((manifest) => (manifest.rig = { boneNames: ["Hip"] }))).toEqual([
      "rig.blendShapeNames: must be a list"
    ]);
    expect(
      manifestIssues(
        (manifest) => (manifest.rig = { boneNames: [3, "Hip", "Hip"], blendShapeNames: [""] })
      )
    ).toEqual([
      "rig.boneNames[0]: must be a name",
      "rig.boneNames[2]: is listed twice",
      "rig.blendShapeNames[0]: must be a name"
    ]);
    expect(manifestIssues((manifest) => (manifest.rig = "generic"))).toEqual([
      "rig: must be an object"
    ]);
    expect(
      manifestIssues((manifest) => (manifest.source = { unityVersion: "", dependencies: ["../x"] }))
    ).toEqual([
      "source.unityVersion: must be a non-empty string",
      "source.dependencies[0]: must be a bundle name"
    ]);
    expect(manifestIssues((manifest) => (manifest.source = []))).toEqual([
      "source: must be an object"
    ]);
    expect(manifestIssues((manifest) => (manifest.source = {}))).toEqual([]);
  });
});

describe("parseModelBundleIndex", () => {
  it("accepts the representative index and returns it", () => {
    const index = motionIndex();

    expect(parseModelBundleIndex(index)).toEqual({ ok: true, value: index });
  });

  it("accepts a region with nothing exported, and ignores unknown fields", () => {
    expect(
      indexIssues((index) => {
        index.region = "en";
        index.models = [];
        index.animations = [];
        index.futureField = 1;
      })
    ).toEqual([]);
  });

  it("rejects anything that is not an object", () => {
    expect(parseModelBundleIndex([])).toEqual({ ok: false, issues: ["index: must be an object"] });
  });

  it("requires the version, region and a real UTC timestamp", () => {
    expect(
      indexIssues((index) => {
        index.schemaVersion = 2;
        index.region = "JP";
        index.generatedAt = "2026-11-15";
      })
    ).toEqual([
      "schemaVersion: must be 1",
      "region: is not a known region",
      "generatedAt: must be an ISO 8601 UTC timestamp"
    ]);
    for (const generatedAt of [
      "2026-13-45T00:00:00Z",
      "2026-02-31T00:00:00Z",
      "2026-11-15T24:00:00Z",
      "2026-11-15T08:00:00+08:00",
      1_794_700_800
    ]) {
      expect(indexIssues((index) => (index.generatedAt = generatedAt))).toEqual([
        "generatedAt: must be an ISO 8601 UTC timestamp"
      ]);
    }
    expect(indexIssues((index) => (index.generatedAt = "2026-11-15T00:00:00.123Z"))).toEqual([]);
  });

  it("checks model entries", () => {
    expect(indexIssues((index) => delete index.models)).toEqual(["models: must be a list"]);
    expect(
      indexIssues(
        (index) => (index.models = [{ bundlePath: "a/b" }, "a/c", { bundlePath: "a/b" }, {}])
      )
    ).toEqual([
      "models[1]: must be an object",
      "models[2].bundlePath: is listed twice",
      "models[3].bundlePath: must be a relative path"
    ]);
  });

  it("keeps animation clips as their own entries with an explicit format", () => {
    const withClips = (clips: unknown) => (index: Record<string, unknown>) => {
      index.animations = [{ bundlePath: "model3d/motion/common/default", clips }];
    };

    for (const clips of [[], undefined, "blink.anim"]) {
      expect(indexIssues(withClips(clips))).toEqual([
        "animations[0].clips: must be a non-empty list"
      ]);
    }
    expect(
      indexIssues(withClips([{ name: "blink", path: "blink.anim", format: "fbx-ascii" }]))
    ).toEqual(['animations[0].clips[0].format: must be "unity-typetree-json"']);
    expect(
      indexIssues(
        withClips([
          { name: "", path: "/blink.anim", format: TYPE_TREE },
          { name: "a", path: "a.anim", format: TYPE_TREE },
          { name: "a", path: "b/a.anim", format: TYPE_TREE },
          { name: "b", path: "a.anim", format: TYPE_TREE },
          "blink.anim"
        ])
      )
    ).toEqual([
      "animations[0].clips[0].name: must be a non-empty string",
      "animations[0].clips[0].path: must be a relative path",
      "animations[0].clips[3].path: is listed twice",
      "animations[0].clips[4]: must be an object"
    ]);
  });

  it("lists an animation bundle once, and lets one bundle hold a model and clips", () => {
    const clips = [{ name: "blink", path: "blink.anim", format: TYPE_TREE }];

    expect(indexIssues((index) => delete index.animations)).toEqual(["animations: must be a list"]);
    expect(
      indexIssues(
        (index) =>
          (index.animations = [
            { bundlePath: "a/b", clips },
            { bundlePath: "a/b", clips }
          ])
      )
    ).toEqual(["animations[1].bundlePath: is listed twice"]);
    expect(
      indexIssues((index) => {
        index.models = [{ bundlePath: "a/b" }];
        index.animations = [{ bundlePath: "a/b", clips }];
      })
    ).toEqual([]);
  });
});

describe("manifest paths", () => {
  it("builds bucket-relative paths that preserve the per-bundle directory", () => {
    const bundle = "live_pv/model/characterv2/body/01/0001/ladies_m";

    expect(MODEL_BUNDLE_INDEX_PATH).toBe("model3d-manifest/v1/index.json");
    expect(modelBundleManifestPath(bundle)).toBe(`${bundle}/fbx/manifest.json`);
    expect(modelBundleFilePath(bundle, "fbx/model.fbx")).toBe(`${bundle}/fbx/model.fbx`);
    expect(modelBundleFilePath("model3d/motion/common/default", "blink.anim")).toBe(
      "model3d/motion/common/default/blink.anim"
    );
  });
});
