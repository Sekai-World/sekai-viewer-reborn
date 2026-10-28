import type { Live2DController } from "../../Live2DController.js";
import type { Snippet } from "../../../../model/scenario-types.js";
import { Live2DAssetType } from "../../player-types.js";
import handleDetachedPromise from "./handle-detached-promise.js";

export default async function ChangeBackground(controller: Live2DController, action: Snippet) {
  const action_detail = controller.scenarioData.SpecialEffectData[action.ReferenceIndex];
  controller.logger.log(
    "Live2DController",
    "SpecialEffect/ChangeBackground",
    action,
    action_detail
  );
  const bg = controller.scenarioResource.image.find(
    (s) => s.identifier === action_detail.StringValSub && s.type === Live2DAssetType.BackgroundImage
  );
  // The dialog fade overlaps the background replacement and must not block it.
  handleDetachedPromise(
    controller.layers.dialog.hide(200),
    controller,
    action,
    "ChangeBackground",
    "dialog hide"
  );
  if (bg)
    handleDetachedPromise(
      controller.layers.background.draw(bg.data),
      controller,
      action,
      "ChangeBackground",
      "background draw"
    );
}
