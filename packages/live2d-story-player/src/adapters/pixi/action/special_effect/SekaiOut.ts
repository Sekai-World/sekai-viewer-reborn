import type { Live2DController } from "../../Live2DController.js";
import type { Snippet } from "../../../../model/scenario-types.js";

export default async function SekaiOut(controller: Live2DController, action: Snippet) {
  const action_detail = controller.scenarioData.SpecialEffectData[action.ReferenceIndex];
  controller.logger.log("Live2DController", "SpecialEffect/SekaiOut", action, action_detail);
  //clear
  controller.layers.dialog.hide(200);
  controller.layers.fullcolor.draw(0xffffff);
  controller.layers.fullcolor.show(action_detail.Duration * 1000, true);
  await controller.layers.sekai.draw("out_corner", action_detail.Duration * 1000);
}
