import type { Live2DController } from "../../Live2DController.js";
import type { Snippet } from "../../../../model/scenario-types.js";

export default async function StopScenarioEffect(controller: Live2DController, action: Snippet) {
  const action_detail = controller.scenarioData.SpecialEffectData[action.ReferenceIndex];
  controller.logger.log(
    "Live2DController",
    "SpecialEffect/StopScenarioEffect",
    action,
    action_detail
  );
  controller.layers.scene_effect.remove(action_detail.StringVal);
}
