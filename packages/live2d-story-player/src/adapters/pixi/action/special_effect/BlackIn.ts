import type { Live2DController } from "../../Live2DController.js";
import type { Snippet } from "../../../../model/scenario-types.js";

export default async function BlackIn(controller: Live2DController, action: Snippet) {
  const action_detail = controller.scenarioData.SpecialEffectData[action.ReferenceIndex];
  controller.logger.log("Live2DController", "SpecialEffect/BlackIn", action, action_detail);
  controller.layers.fullcolor.draw(0x000000);
  controller.layers.fullscreen_text.hide(100);
  await controller.layers.fullcolor.hide(action_detail.Duration * 1000, false);
}
