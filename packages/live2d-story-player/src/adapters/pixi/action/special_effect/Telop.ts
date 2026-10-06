import type { Live2DController } from "../../Live2DController.js";
import type { Snippet } from "../../../../model/scenario-types.js";

export default async function Telop(controller: Live2DController, action: Snippet) {
  const action_detail = controller.scenarioData.SpecialEffectData[action.ReferenceIndex];
  controller.logger.log("Live2DController", "SpecialEffect/Telop", action, action_detail);

  // Host-provided text policy; falls back to the original scenario text.
  const resolved = controller.resolveText("telop", action.ReferenceIndex, action_detail.StringVal);
  const displayText = resolved.displayText;
  const translatedDisplayText = resolved.translatedText;

  controller.layers.telop.draw(displayText, translatedDisplayText);

  //clear
  controller.layers.dialog.hide(200);

  await controller.layers.telop.show(300, true);
}
