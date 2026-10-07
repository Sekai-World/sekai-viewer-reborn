import type { Live2DController } from "../../Live2DController.js";
import type { Snippet } from "../../../../model/scenario-types.js";

export default async function FlashbackIn(controller: Live2DController, action: Snippet) {
  const action_detail = controller.scenarioData.SpecialEffectData[action.ReferenceIndex];
  controller.logger.log("Live2DController", "SpecialEffect/FlashbackIn", action, action_detail);
  controller.layers.flashback_filter.draw(0x000000, 0.3);
  await controller.layers.flashback_filter.show(100, true);
}
