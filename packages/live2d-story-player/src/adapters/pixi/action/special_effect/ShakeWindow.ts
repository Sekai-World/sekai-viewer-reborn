import type { Live2DController } from "../../Live2DController.js";
import { Curve } from "../../animation/Curve.js";
import type { Snippet } from "../../../../model/scenario-types.js";

export default async function ShakeWindow(controller: Live2DController, action: Snippet) {
  const action_detail = controller.scenarioData.SpecialEffectData[action.ReferenceIndex];
  controller.logger.log("Live2DController", "SpecialEffect/ShakeWindow", action, action_detail);
  const time_ms = action_detail.Duration * 1000;
  const freq = 30;
  const amp = 0.01 * controller.stage_size[1];
  const curve_x = new Curve().wiggle(Math.floor((time_ms / 1000) * freq)).map_range(-amp, amp);
  const curve_y = new Curve().wiggle(Math.floor((time_ms / 1000) * freq)).map_range(-amp, amp);
  controller.layers.dialog.shake(curve_x, curve_y, time_ms);
}
