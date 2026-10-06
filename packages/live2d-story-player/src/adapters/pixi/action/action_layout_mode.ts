import type { Live2DController } from "../Live2DController.js";
import type { Snippet } from "../../../model/scenario-types.js";
import { CharacterLayoutMode } from "../../../model/scenario-types.js";

export default async function action_layout_mode(controller: Live2DController, action: Snippet) {
  const action_detail =
    controller.scenarioData.ScenarioSnippetCharacterLayoutModes[action.ReferenceIndex];
  controller.logger.log("Live2DController", "CharacterLayoutMode", action, action_detail);
  switch (action_detail.CharacterLayoutMode) {
    case CharacterLayoutMode.Normal:
      controller.layers.live2d.layout_mode = "normal";
      break;
    case CharacterLayoutMode.ThreeModels:
      controller.layers.live2d.layout_mode = "three_models";
      break;
  }
}
