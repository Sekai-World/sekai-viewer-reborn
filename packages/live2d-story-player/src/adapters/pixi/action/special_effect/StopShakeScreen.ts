import type { Live2DController } from "../../Live2DController.js";
import type { Snippet } from "../../../../model/scenario-types.js";

export default async function StopShakeScreen(controller: Live2DController, action: Snippet) {
  const action_detail = controller.scenarioData.SpecialEffectData[action.ReferenceIndex];
  controller.logger.log("Live2DController", "SpecialEffect/StopShakeScreen", action, action_detail);
  controller.layers.background.stop_shake();
  controller.layers.live2d.stop_shake();
}
