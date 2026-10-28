import type { Live2DController } from "../../Live2DController.js";
import type { Snippet } from "../../../../model/scenario-types.js";
import handleDetachedPromise from "./handle-detached-promise.js";

export default async function BlackWipeOutTop(controller: Live2DController, action: Snippet) {
  const action_detail = controller.scenarioData.SpecialEffectData[action.ReferenceIndex];
  controller.logger.log("Live2DController", "SpecialEffect/BlackWipeOutTop", action, action_detail);
  handleDetachedPromise(
    controller.layers.wipe.draw(),
    controller,
    action,
    "BlackWipeOutTop",
    "wipe draw"
  );
  await controller.layers.wipe.animate(true, "top", action_detail.Duration * 1000);
}
