import type { Live2DController } from "../../Live2DController.js";
import type { Snippet } from "../../../../model/scenario-types.js";
import { Live2DAssetType } from "../../player-types.js";

export default async function FlashbackIn(controller: Live2DController, action: Snippet) {
  const action_detail = controller.scenarioData.SpecialEffectData[action.ReferenceIndex];
  controller.logger.log("Live2DController", "SpecialEffect/FullScreenText", action, action_detail);
  const sound = controller.scenarioResource.audio.find(
    (s) => s.identifier === action_detail.StringValSub && s.type === Live2DAssetType.Talk
  );
  if (sound && !controller.replay_silent) {
    controller.stop_sounds([Live2DAssetType.Talk]);
    const inst = sound.data;
    controller.audioAdapter.setVolume(inst, controller.settings.voice_volume);
    controller.audioAdapter.play(inst);
  } else if (!sound) {
    controller.logger.warn("Live2DController", `${action_detail.StringValSub} not loaded, skip.`);
    controller.events.emit("warn", `${action_detail.StringValSub} not loaded, skip.`);
  }
  // Host-provided text policy; falls back to the original scenario text.
  const resolved = controller.resolveText(
    "fullscreen",
    action.ReferenceIndex,
    action_detail.StringVal
  );
  const displayText = resolved.displayText;
  const translatedDisplayText = resolved.translatedText;

  controller.layers.fullscreen_text.show(500);
  if (controller.settings.text_animation) {
    await controller.layers.fullscreen_text.animate(displayText, translatedDisplayText);
  } else {
    controller.layers.fullscreen_text.draw(displayText, translatedDisplayText);
  }
}
