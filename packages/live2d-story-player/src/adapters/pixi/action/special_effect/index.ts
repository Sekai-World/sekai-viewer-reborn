import type { Live2DController } from "../../Live2DController.js";
import type { Snippet } from "../../../../model/scenario-types.js";
import { SpecialEffectType, SnippetAction } from "../../../../model/scenario-types.js";

import ChangeBackground from "./ChangeBackground.js";
import Telop from "./Telop.js";
import PlaceInfo from "./PlaceInfo.js";
import WhiteIn from "./WhiteIn.js";
import WhiteOut from "./WhiteOut.js";
import BlackIn from "./BlackIn.js";
import BlackOut from "./BlackOut.js";
import FlashbackIn from "./FlashbackIn.js";
import FlashbackOut from "./FlashbackOut.js";
import AttachCharacterShader from "./AttachCharacterShader.js";
import PlayScenarioEffect from "./PlayScenarioEffect.js";
import StopScenarioEffect from "./StopScenarioEffect.js";
import ShakeScreen from "./ShakeScreen.js";
import ShakeWindow from "./ShakeWindow.js";
import StopShakeScreen from "./StopShakeScreen.js";
import StopShakeWindow from "./StopShakeWindow.js";
import AmbientColorNormal from "./AmbientColorNormal.js";
import AmbientColorEvening from "./AmbientColorEvening.js";
import AmbientColorNight from "./AmbientColorNight.js";
import BlackWipeInLeft from "./BlackWipeInLeft.js";
import BlackWipeOutLeft from "./BlackWipeOutLeft.js";
import BlackWipeInRight from "./BlackWipeInRight.js";
import BlackWipeOutRight from "./BlackWipeOutRight.js";
import BlackWipeInTop from "./BlackWipeInTop.js";
import BlackWipeOutTop from "./BlackWipeOutTop.js";
import BlackWipeInBottom from "./BlackWipeInBottom.js";
import BlackWipeOutBottom from "./BlackWipeOutBottom.js";
import SekaiIn from "./SekaiIn.js";
import SekaiOut from "./SekaiOut.js";
import SimpleSelectable from "./SimpleSelectable.js";
import FullScreenText from "./FullScreenText.js";
import FullScreenTextShow from "./FullScreenTextShow.js";
import FullScreenTextHide from "./FullScreenTextHide.js";
import MemoryIn from "./MemoryIn.js";
import MemoryOut from "./MemoryOut.js";
import SekaiInCenter from "./SekaiInCenter.js";
import SekaiOutCenter from "./SekaiOutCenter.js";
import ChangeCameraPosition from "./ChangeCameraPosition.js";
import ChangeCameraZoomLevel from "./ChangeCameraZoomLevel.js";
import Movie from "./Movie.js";
import Blur from "./Blur.js";

type SpecialEffectAction = (controller: Live2DController, action: Snippet) => Promise<void> | void;

const actionsByEffectType: Partial<Record<SpecialEffectType, SpecialEffectAction>> = {
  [SpecialEffectType.ChangeBackground]: ChangeBackground,
  [SpecialEffectType.Telop]: Telop,
  [SpecialEffectType.PlaceInfo]: PlaceInfo,
  [SpecialEffectType.WhiteIn]: WhiteIn,
  [SpecialEffectType.WhiteOut]: WhiteOut,
  [SpecialEffectType.BlackIn]: BlackIn,
  [SpecialEffectType.BlackOut]: BlackOut,
  [SpecialEffectType.FlashbackIn]: FlashbackIn,
  [SpecialEffectType.FlashbackOut]: FlashbackOut,
  [SpecialEffectType.AttachCharacterShader]: AttachCharacterShader,
  [SpecialEffectType.PlayScenarioEffect]: PlayScenarioEffect,
  [SpecialEffectType.StopScenarioEffect]: StopScenarioEffect,
  [SpecialEffectType.ShakeScreen]: ShakeScreen,
  [SpecialEffectType.ShakeWindow]: ShakeWindow,
  [SpecialEffectType.StopShakeScreen]: StopShakeScreen,
  [SpecialEffectType.StopShakeWindow]: StopShakeWindow,
  [SpecialEffectType.AmbientColorNormal]: AmbientColorNormal,
  [SpecialEffectType.AmbientColorEvening]: AmbientColorEvening,
  [SpecialEffectType.AmbientColorNight]: AmbientColorNight,
  [SpecialEffectType.BlackWipeInLeft]: BlackWipeInLeft,
  [SpecialEffectType.BlackWipeOutLeft]: BlackWipeOutLeft,
  [SpecialEffectType.BlackWipeInRight]: BlackWipeInRight,
  [SpecialEffectType.BlackWipeOutRight]: BlackWipeOutRight,
  [SpecialEffectType.BlackWipeInTop]: BlackWipeInTop,
  [SpecialEffectType.BlackWipeOutTop]: BlackWipeOutTop,
  [SpecialEffectType.BlackWipeInBottom]: BlackWipeInBottom,
  [SpecialEffectType.BlackWipeOutBottom]: BlackWipeOutBottom,
  [SpecialEffectType.SekaiIn]: SekaiIn,
  [SpecialEffectType.SekaiOut]: SekaiOut,
  [SpecialEffectType.SimpleSelectable]: SimpleSelectable,
  [SpecialEffectType.FullScreenText]: FullScreenText,
  [SpecialEffectType.FullScreenTextShow]: FullScreenTextShow,
  [SpecialEffectType.FullScreenTextHide]: FullScreenTextHide,
  [SpecialEffectType.MemoryIn]: MemoryIn,
  [SpecialEffectType.MemoryOut]: MemoryOut,
  [SpecialEffectType.SekaiInCenter]: SekaiInCenter,
  [SpecialEffectType.SekaiOutCenter]: SekaiOutCenter,
  [SpecialEffectType.ChangeCameraPosition]: ChangeCameraPosition,
  [SpecialEffectType.ChangeCameraZoomLevel]: ChangeCameraZoomLevel,
  [SpecialEffectType.Movie]: Movie,
  [SpecialEffectType.Blur]: Blur
};

export default async function action_se(controller: Live2DController, action: Snippet) {
  const action_detail = controller.scenarioData.SpecialEffectData[action.ReferenceIndex];
  //clear
  await controller.layers.telop.hide(200);

  const effectAction = actionsByEffectType[action_detail.EffectType];
  if (effectAction) {
    await effectAction(controller, action);
    return;
  }
  controller.logger.warn(
    "Live2DController",
    `${SnippetAction[action.Action]}/${SpecialEffectType[action_detail.EffectType]} not implemented!`,
    action,
    action_detail
  );
  controller.events.emit(
    "warn",
    `${SnippetAction[action.Action]}/${SpecialEffectType[action_detail.EffectType]} not implemented!`
  );
}
