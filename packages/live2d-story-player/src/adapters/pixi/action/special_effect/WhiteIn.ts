import type { Live2DController } from "../../Live2DController.js";
import type { Snippet } from "../../../../model/scenario-types.js";

export default async function WhiteIn(controller: Live2DController, action: Snippet) {
  const action_detail = controller.scenarioData.SpecialEffectData[action.ReferenceIndex];
  controller.logger.log("Live2DController", "SpecialEffect/WhiteIn", action, action_detail);
  controller.layers.fullcolor.draw(0xffffff);
  await controller.layers.fullcolor.hide(action_detail.Duration * 1000, true);
}
