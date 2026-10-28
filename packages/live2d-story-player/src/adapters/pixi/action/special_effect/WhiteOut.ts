import type { Live2DController } from "../../Live2DController.js";
import type { Snippet } from "../../../../model/scenario-types.js";
import handleDetachedPromise from "./handle-detached-promise.js";

export default async function WhiteOut(controller: Live2DController, action: Snippet) {
  const action_detail = controller.scenarioData.SpecialEffectData[action.ReferenceIndex];
  controller.logger.log("Live2DController", "SpecialEffect/WhiteOut", action, action_detail);
  handleDetachedPromise(
    controller.layers.dialog.hide(100),
    controller,
    action,
    "WhiteOut",
    "dialog hide"
  );
  handleDetachedPromise(
    controller.layers.fullcolor.draw(0xffffff),
    controller,
    action,
    "WhiteOut",
    "fullcolor draw"
  );
  await controller.layers.fullcolor.show(action_detail.Duration * 1000, true);
}
