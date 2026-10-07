import type { Live2DController } from "../../Live2DController.js";
import type { Snippet } from "../../../../model/scenario-types.js";

export default async function MemoryOut(controller: Live2DController, action: Snippet) {
  const action_detail = controller.scenarioData.SpecialEffectData[action.ReferenceIndex];
  controller.logger.log("Live2DController", "SpecialEffect/MemoryOut", action, action_detail);
  controller.layers.live2d.remove_filter();
  controller.layers.background.remove_filter();
}
