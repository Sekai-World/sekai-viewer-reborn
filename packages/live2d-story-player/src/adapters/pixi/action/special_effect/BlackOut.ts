import type { Live2DController } from "../../Live2DController.js";
import type { Snippet } from "../../../../model/scenario-types.js";
import handleDetachedPromise from "./handle-detached-promise.js";

export default async function BlackOut(controller: Live2DController, action: Snippet) {
  const action_detail = controller.scenarioData.SpecialEffectData[action.ReferenceIndex];
  controller.logger.log("Live2DController", "SpecialEffect/BlackOut", action, action_detail);
  handleDetachedPromise(
    controller.layers.dialog.hide(100),
    controller,
    action,
    "BlackOut",
    "dialog hide"
  );
  handleDetachedPromise(
    controller.layers.fullcolor.draw(0x000000),
    controller,
    action,
    "BlackOut",
    "fullcolor draw"
  );
  await controller.layers.fullcolor.show(action_detail.Duration * 1000, true);
}
