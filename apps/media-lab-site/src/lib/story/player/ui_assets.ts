import type { ILive2DAssetUrl } from "./player-types";
import { Live2DAssetType } from "./player-types";
import type { IScenarioData } from "../scenario-types";
import {
  SnippetAction,
  SpecialEffectType,
  SeScenarioEffectType,
} from "../scenario-types";

const text_underline = "/live2d/story-player-ui/text_underline.svg";
const text_background = "/live2d/story-player-ui/text_background.svg";
const black_wipe = "/live2d/story-player-ui/black_wipe.svg";

/**
 * Builds the player UI asset URLs. `regionAssetUrl` resolves scenario-effect
 * textures on the story region's asset bucket; the base UI sprites are
 * app-static assets.
 */
export function getUIMediaUrls(
  data: IScenarioData,
  regionAssetUrl: (path: string) => string
): ILive2DAssetUrl[] {
  const common = [
    {
      identifier: "ui/text_underline",
      type: Live2DAssetType.UI,
      url: text_underline,
    },
    {
      identifier: "ui/text_background",
      type: Live2DAssetType.UI,
      url: text_background,
    },
    {
      identifier: "ui/black_wipe",
      type: Live2DAssetType.UI,
      url: black_wipe,
    },
  ];

  const condition: Record<string, ILive2DAssetUrl[]> = {
    sekai: [
      {
        identifier: "ui/tex_scenario_tri_01",
        type: Live2DAssetType.UISheet,
        url: regionAssetUrl(
          "scenario/effect/hologram/tex_scenario_tri_01.webp"
        ),
      },
    ],
    hologram: [
      {
        identifier: "ui/tex_scenario_tri_01",
        type: Live2DAssetType.UISheet,
        url: regionAssetUrl(
          "scenario/effect/hologram/tex_scenario_tri_01.webp"
        ),
      },
      {
        identifier: "ui/tex_scenario_kira",
        type: Live2DAssetType.UI,
        url: regionAssetUrl("scenario/effect/hologram/tex_scenario_kira.webp"),
      },
      {
        identifier: "ui/tex_scenario_light",
        type: Live2DAssetType.UI,
        url: regionAssetUrl("scenario/effect/hologram/tex_scenario_light.webp"),
      },
    ],
    kirakira: [
      {
        identifier: "ui/tex_kirakira_01",
        type: Live2DAssetType.UISheet,
        url: regionAssetUrl(
          "scenario/effect/kirakira_01/tex_kirakira_01.webp"
        ),
      },
    ],
    light_up_legend: [
      {
        identifier: "ui/tex_light_up_legend",
        type: Live2DAssetType.UISheet,
        url: regionAssetUrl(
          "scenario/effect/light_up_legend_01/tex_light_up_legend.webp"
        ),
      },
    ],
  };

  const all = [...common];
  const category = new Set<string>();
  // analyze scenario data, find which is necessary
  data.Snippets.forEach((sn) => {
    if (sn.Action === SnippetAction.SpecialEffect) {
      const sp = data.SpecialEffectData[sn.ReferenceIndex];
      const t = sp.EffectType;
      if (t === SpecialEffectType.SekaiIn) category.add("sekai");
      else if (t === SpecialEffectType.SekaiOut) category.add("sekai");
      else if (t === SpecialEffectType.SekaiInCenter) category.add("sekai");
      else if (t === SpecialEffectType.SekaiOutCenter) category.add("sekai");
      else if (t === SpecialEffectType.AttachCharacterShader)
        category.add("hologram");
      else if (t === SpecialEffectType.PlayScenarioEffect) {
        if (SeScenarioEffectType.kirakira.includes(sp.StringVal))
          category.add("kirakira");
        else if (SeScenarioEffectType.light_up_legend.includes(sp.StringVal))
          category.add("light_up_legend");
      }
    }
  });
  category.forEach((c) => {
    condition[c]?.forEach((i) => {
      const find = all.find((a) => a.identifier === i.identifier);
      if (!find) all.push(i);
    });
  });
  return all;
}
