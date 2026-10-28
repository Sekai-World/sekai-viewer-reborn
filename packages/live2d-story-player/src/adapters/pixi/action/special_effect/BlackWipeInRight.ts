import type { Live2DController } from "../../Live2DController.js";
import type { Snippet } from "../../../../model/scenario-types.js";
import handleDetachedPromise from "./handle-detached-promise.js";

export default async function BlackWipeInRight(controller: Live2DController, action: Snippet) {
  const action_detail = controller.scenarioData.SpecialEffectData[action.ReferenceIndex];
  controller.logger.log(
    "Live2DController",
    "SpecialEffect/BlackWipeInRight",
    action,
    action_detail
  );
  handleDetachedPromise(
    controller.layers.wipe.draw(),
    controller,
    action,
    "BlackWipeInRight",
    "wipe draw"
  );
  await controller.layers.wipe.animate(false, "left", action_detail.Duration * 1000);
}
