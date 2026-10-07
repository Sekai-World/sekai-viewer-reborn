import type { Live2DController } from "../../Live2DController.js";
import type { Snippet } from "../../../../model/scenario-types.js";

export default async function BlackWipeInLeft(controller: Live2DController, action: Snippet) {
  const action_detail = controller.scenarioData.SpecialEffectData[action.ReferenceIndex];
  controller.logger.log("Live2DController", "SpecialEffect/BlackWipeInLeft", action, action_detail);
  controller.layers.wipe.draw();
  await controller.layers.wipe.animate(false, "right", action_detail.Duration * 1000);
}
