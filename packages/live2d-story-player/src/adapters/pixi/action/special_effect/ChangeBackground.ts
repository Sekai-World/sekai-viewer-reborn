import type { Live2DController } from "../../Live2DController.js";
import type { Snippet } from "../../../../model/scenario-types.js";
import { Live2DAssetType } from "../../player-types.js";

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
  //clear
  controller.layers.dialog.hide(200);
  if (bg) controller.layers.background.draw(bg.data);
}
