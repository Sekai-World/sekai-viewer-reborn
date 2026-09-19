import type { Live2DController } from "../../Live2DController";
import type { Snippet } from "../../../scenario-types";
import { Live2DAssetType } from "../../player-types";
import { log } from "../../log";

export default async function FlashbackIn(controller: Live2DController, action: Snippet) {
  const action_detail = controller.scenarioData.SpecialEffectData[action.ReferenceIndex];
  log.log("Live2DController", "SpecialEffect/FullScreenText", action, action_detail);
  const sound = controller.scenarioResource.audio.find(
    (s) => s.identifier === action_detail.StringValSub && s.type === Live2DAssetType.Talk
  );
  if (sound && !controller.replay_silent) {
    controller.stop_sounds([Live2DAssetType.Talk]);
    const inst = sound.data;
    inst.volume(controller.settings.voice_volume);
    inst.play();
  } else if (!sound) {
    log.warn("Live2DController", `${action_detail.StringValSub} not loaded, skip.`);
    controller.events.emit("warn", `${action_detail.StringValSub} not loaded, skip.`);
  }
  // Host-provided text policy; falls back to the original scenario text.
  const resolved = controller.textResolver
    ? controller.textResolver.resolve(
        `fullscreen_texts_${action.ReferenceIndex}`,
        action_detail.StringVal
      )
    : { displayText: action_detail.StringVal, translatedText: null };
  const displayText = resolved.displayText;
  const translatedDisplayText = resolved.translatedText;

  controller.layers.fullscreen_text.show(500);
  if (controller.settings.text_animation) {
    await controller.layers.fullscreen_text.animate(displayText, translatedDisplayText);
  } else {
    controller.layers.fullscreen_text.draw(displayText, translatedDisplayText);
  }
}
