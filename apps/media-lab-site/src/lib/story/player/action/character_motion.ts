import type { Live2DController } from "../Live2DController";
import type { Snippet } from "../../scenario-types";
import { CharacterLayoutType, SnippetAction } from "../../scenario-types";
import { log } from "../log";

export default async function action_motion(
  controller: Live2DController,
  action: Snippet
) {
  const action_detail =
    controller.scenarioData.LayoutData[action.ReferenceIndex];
  if (action_detail.Type === CharacterLayoutType.CharacterMotion) {
    log.log(
      "Live2DController",
      "CharacterMotion/CharacterMotion",
      action,
      action_detail
    );
    // Step 1: Apply motions and expressions.
    await controller.apply_live2d_motion(
      controller.live2d_get_costume(action_detail.Character2dId)!,
      action_detail.MotionName,
      action_detail.FacialName
    );
  } else {
    log.warn(
      "Live2DController",
      `${SnippetAction[action.Action]}/${CharacterLayoutType[action_detail.Type]} not implemented!`,
      action,
      action_detail
    );
    controller.events.emit(
      "warn",
      `${SnippetAction[action.Action]}/${CharacterLayoutType[action_detail.Type]} not implemented!`
    );
  }
}
