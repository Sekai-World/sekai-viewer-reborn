import type { Live2DController } from "../Live2DController";
import type { Snippet } from "../../scenario-types";
import { Live2DAssetType } from "../player-types";
import { log } from "../log";

export default async function action_talk(controller: Live2DController, action: Snippet) {
  const action_detail = controller.scenarioData.TalkData[action.ReferenceIndex];
  log.log("Live2DController", "Talk", action, action_detail);

  // Host-provided text policy; falls back to the original scenario text.
  const resolved = controller.textResolver
    ? controller.textResolver.resolve(`talk_${action.ReferenceIndex}`, action_detail.Body)
    : { displayText: action_detail.Body, translatedText: null };
  const displayText = resolved.displayText;
  const translatedText = resolved.translatedText;

  //clear
  await controller.layers.telop.hide(200);
  // show dialog — silently replayed go-back draws the line instantly
  let dialog;
  if (controller.replay_silent || !controller.settings.text_animation) {
    controller.layers.dialog.draw(action_detail.WindowDisplayName, displayText, translatedText);
  } else {
    dialog = controller.layers.dialog.animate(
      action_detail.WindowDisplayName,
      displayText,
      translatedText
    );
  }

  await controller.layers.dialog.show(200);
  // motion
  for (const m of action_detail.Motions) {
    controller.apply_live2d_motion(
      controller.live2d_get_costume(m.Character2dId)!,
      m.MotionName,
      m.FacialName
    );
  }
  // sound — silent replay must not blast through every voice on the way back
  if (action_detail.Voices.length > 0 && !controller.replay_silent) {
    controller.layers.live2d.stop_speaking();
    controller.stop_sounds([Live2DAssetType.Talk]);
    const sound = controller.scenarioResource.audio.find(
      (s) => s.identifier === action_detail.Voices[0].VoiceId && s.type === Live2DAssetType.Talk
    );
    if (sound) {
      const costumes = action_detail.TalkCharacters.map((c) =>
        controller.live2d_get_costume(c.Character2dId)
      ).filter((i) => i !== undefined);
      const volume = action_detail.Voices[0].Volume * controller.settings.voice_volume;
      if (costumes.length > 0 && action_detail.LipSync == 1) {
        controller.layers.live2d.speak(costumes, sound.data, volume);
        log.log("Live2DController", "Talk/speak", costumes, sound.data);
      } else {
        const inst = sound.data;
        inst.volume(volume);
        inst.play();
      }
    } else {
      log.warn("Live2DController", `${action_detail.Voices[0].VoiceId} not loaded, skip.`);
      controller.events.emit("warn", `${action_detail.Voices[0].VoiceId} not loaded, skip.`);
    }
  }
  // wait for the text animation
  await dialog;
}
