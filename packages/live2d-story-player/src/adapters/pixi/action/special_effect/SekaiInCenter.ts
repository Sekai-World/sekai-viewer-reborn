import type { Live2DController } from "../../Live2DController.js";
import type { Snippet } from "../../../../model/scenario-types.js";
import handleDetachedPromise from "./handle-detached-promise.js";

export default async function SekaiInCenter(controller: Live2DController, action: Snippet) {
  const action_detail = controller.scenarioData.SpecialEffectData[action.ReferenceIndex];
  controller.logger.log("Live2DController", "SpecialEffect/SekaiInCenter", action, action_detail);
  const duration = action_detail.Duration * 1000;
  handleDetachedPromise(
    controller.layers.fullcolor.hide(duration),
    controller,
    action,
    "SekaiInCenter",
    "fullcolor hide"
  );
  await controller.layers.sekai.draw("in_center", duration);
}
