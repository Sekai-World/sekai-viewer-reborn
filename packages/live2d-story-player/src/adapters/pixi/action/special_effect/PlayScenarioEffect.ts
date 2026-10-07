import type { Live2DController } from "../../Live2DController.js";
import type { Snippet } from "../../../../model/scenario-types.js";

export default async function PlayScenarioEffect(controller: Live2DController, action: Snippet) {
  const action_detail = controller.scenarioData.SpecialEffectData[action.ReferenceIndex];
  controller.logger.log(
    "Live2DController",
    "SpecialEffect/PlayScenarioEffect",
    action,
    action_detail
  );
  controller.layers.scene_effect.draw(action_detail.StringVal, controller.events);
}
