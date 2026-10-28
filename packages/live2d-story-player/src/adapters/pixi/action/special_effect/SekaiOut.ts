import type { Live2DController } from "../../Live2DController.js";
import type { Snippet } from "../../../../model/scenario-types.js";
import handleDetachedPromise from "./handle-detached-promise.js";

export default async function SekaiOut(controller: Live2DController, action: Snippet) {
  const action_detail = controller.scenarioData.SpecialEffectData[action.ReferenceIndex];
  controller.logger.log("Live2DController", "SpecialEffect/SekaiOut", action, action_detail);
  const duration = action_detail.Duration * 1000;
  handleDetachedPromise(
    controller.layers.dialog.hide(200),
    controller,
    action,
    "SekaiOut",
    "dialog hide"
  );
  handleDetachedPromise(
    controller.layers.fullcolor.draw(0xffffff),
    controller,
    action,
    "SekaiOut",
    "fullcolor draw"
  );
  handleDetachedPromise(
    controller.layers.fullcolor.show(duration, true),
    controller,
    action,
    "SekaiOut",
    "fullcolor show"
  );
  await controller.layers.sekai.draw("out_corner", duration);
}
