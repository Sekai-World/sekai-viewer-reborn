import type { Live2DController } from "../../Live2DController";
import type { Snippet } from "../../../scenario-types";
import { log } from "../../log";

export default async function Telop(
  controller: Live2DController,
  action: Snippet
) {
  const action_detail =
    controller.scenarioData.SpecialEffectData[action.ReferenceIndex];
  log.log("Live2DController", "SpecialEffect/Telop", action, action_detail);

  // Host-provided text policy; falls back to the original scenario text.
  const resolved = controller.textResolver
    ? controller.textResolver.resolve(`telop_${action.ReferenceIndex}`, action_detail.StringVal)
    : { displayText: action_detail.StringVal, translatedText: null };
  const displayText = resolved.displayText;
  const translatedDisplayText = resolved.translatedText;

  controller.layers.telop.draw(displayText, translatedDisplayText);

  //clear
  controller.layers.dialog.hide(200);

  await controller.layers.telop.show(300, true);
}
