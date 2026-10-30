import type { Live2DController } from "../Live2DController.js";
import type { Snippet } from "../../../model/scenario-types.js";
import { Live2DAssetType } from "../player-types.js";
import { setSoundGain } from "../audio-volume.js";

type PromiseOutcome = { status: "fulfilled" } | { status: "rejected"; reason: unknown };

const settle = (promise: Promise<void>): Promise<PromiseOutcome> =>
  promise.then(
    () => ({ status: "fulfilled" }),
    (reason: unknown) => ({ status: "rejected", reason })
  );

export default async function action_talk(controller: Live2DController, action: Snippet) {
  const action_detail = controller.scenarioData.TalkData[action.ReferenceIndex];
  controller.logger.log("Live2DController", "Talk", action, action_detail);

  // Host-provided text policy; falls back to the original scenario text.
  const resolved = controller.resolveText("talk", action.ReferenceIndex, action_detail.Body);
  const displayText = resolved.displayText;
  const translatedText = resolved.translatedText;

  //clear
  await controller.layers.telop.hide(200);
  // show dialog — silently replayed go-back draws the line instantly
  let dialog_outcome: Promise<PromiseOutcome> = Promise.resolve({ status: "fulfilled" });
  if (controller.replay_silent || !controller.settings.text_animation) {
    await controller.layers.dialog.draw(
      action_detail.WindowDisplayName,
      displayText,
      translatedText
    );
  } else {
    dialog_outcome = settle(
      controller.layers.dialog.animate(action_detail.WindowDisplayName, displayText, translatedText)
    );
  }

  await controller.layers.dialog.show(200);
  // motion
  for (const m of action_detail.Motions) {
    controller
      .apply_live2d_motion(
        controller.live2d_get_costume(m.Character2dId)!,
        m.MotionName,
        m.FacialName
      )
      .catch((error: unknown) => {
        controller.logger.warn("Live2DController", "Talk motion failed:", action, error);
        controller.events.emit("warn", `Talk motion failed: ${String(error)}`);
      });
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
      setSoundGain(sound.data, action_detail.Voices[0].Volume);
      const volume = action_detail.Voices[0].Volume * controller.settings.voice_volume;
      if (costumes.length > 0 && action_detail.LipSync == 1) {
        controller.layers.live2d.speak(costumes, sound.data, volume);
        controller.logger.log("Live2DController", "Talk/speak", costumes, sound.data);
      } else {
        const inst = sound.data;
        controller.audioAdapter.setVolume(inst, volume);
        controller.audioAdapter.play(inst);
      }
    } else {
      controller.logger.warn(
        "Live2DController",
        `${action_detail.Voices[0].VoiceId} not loaded, skip.`
      );
      controller.events.emit("warn", `${action_detail.Voices[0].VoiceId} not loaded, skip.`);
    }
  }
  // Text rendering remains part of the talk action; motions are intentionally
  // non-blocking alongside voice playback and report failures independently.
  const failure = await dialog_outcome;
  if (failure?.status === "rejected") throw failure.reason;
}
