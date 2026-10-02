import type { Live2DController } from "../../Live2DController.js";
import type { Snippet } from "../../../../model/scenario-types.js";

export default async function ChangeCameraZoomLevel(controller: Live2DController, action: Snippet) {
  const action_detail = controller.scenarioData.SpecialEffectData[action.ReferenceIndex];
  controller.logger.log(
    "Live2DController",
    "SpecialEffect/ChangeCameraZoomLevel",
    action,
    action_detail
  );
  const from = [...controller.camera.scale];
  const to = [
    Number.parseFloat(action_detail.StringVal),
    Number.parseFloat(action_detail.StringVal)
  ];
  controller.animate.progress_wrapper((progress) => {
    controller.camera.scale[0] = from[0] + (to[0] - from[0]) * progress;
    controller.camera.scale[1] = from[1] + (to[1] - from[1]) * progress;
    controller.set_style();
  }, action_detail.Duration * 1000);
}
