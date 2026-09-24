import type { Live2DController } from "../../Live2DController";
import type { Snippet } from "../../../scenario-types";
import { log } from "../../log";

export default async function FlashbackOut(controller: Live2DController, action: Snippet) {
  const action_detail = controller.scenarioData.SpecialEffectData[action.ReferenceIndex];
  log.log("Live2DController", "SpecialEffect/FlashbackOut", action, action_detail);
  await controller.layers.flashback_filter.hide(100, true);
}
