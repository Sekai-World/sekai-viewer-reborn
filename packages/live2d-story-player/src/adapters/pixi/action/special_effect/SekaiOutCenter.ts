import type { Live2DController } from "../../Live2DController.js";
import type { Snippet } from "../../../../model/scenario-types.js";
import handleDetachedPromise from "./handle-detached-promise.js";

export default async function SekaiOutCenter(controller: Live2DController, action: Snippet) {
  const action_detail = controller.scenarioData.SpecialEffectData[action.ReferenceIndex];
  controller.logger.log("Live2DController", "SpecialEffect/SekaiOutCenter", action, action_detail);
  const duration = action_detail.Duration * 1000;
  handleDetachedPromise(
    controller.layers.fullcolor.draw(0xffffff),
    controller,
    action,
    "SekaiOutCenter",
    "fullcolor draw"
  );
  handleDetachedPromise(
    controller.layers.fullcolor.show(duration, true),
    controller,
    action,
    "SekaiOutCenter",
    "fullcolor show"
  );
  await controller.layers.sekai.draw("out_center", duration);
}
