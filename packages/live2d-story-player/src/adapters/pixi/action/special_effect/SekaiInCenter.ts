import type { Live2DController } from "../../Live2DController.js";
import type { Snippet } from "../../../../model/scenario-types.js";

export default async function SekaiInCenter(controller: Live2DController, action: Snippet) {
  const action_detail = controller.scenarioData.SpecialEffectData[action.ReferenceIndex];
  controller.logger.log("Live2DController", "SpecialEffect/SekaiInCenter", action, action_detail);
  controller.layers.fullcolor.hide(action_detail.Duration * 1000);
  await controller.layers.sekai.draw("in_center", action_detail.Duration * 1000);
}
