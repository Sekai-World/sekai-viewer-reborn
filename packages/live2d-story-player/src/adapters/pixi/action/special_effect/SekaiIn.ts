import type { Live2DController } from "../../Live2DController.js";
import type { Snippet } from "../../../../model/scenario-types.js";

export default async function SekaiIn(controller: Live2DController, action: Snippet) {
  const action_detail = controller.scenarioData.SpecialEffectData[action.ReferenceIndex];
  controller.logger.log("Live2DController", "SpecialEffect/SekaiIn", action, action_detail);
  controller.layers.fullcolor.hide(action_detail.Duration * 1000);
  controller.layers.dialog.hide(200);
  await controller.layers.sekai.draw("in_corner", action_detail.Duration * 1000);
}
