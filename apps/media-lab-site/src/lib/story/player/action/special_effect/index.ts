import type { Live2DController } from "../../Live2DController";
import type { Snippet } from "../../../scenario-types";
import { SpecialEffectType, SnippetAction } from "../../../scenario-types";
import { log } from "../../log";

import ChangeBackground from "./ChangeBackground";
import Telop from "./Telop";
import PlaceInfo from "./PlaceInfo";
import WhiteIn from "./WhiteIn";
import WhiteOut from "./WhiteOut";
import BlackIn from "./BlackIn";
import BlackOut from "./BlackOut";
import FlashbackIn from "./FlashbackIn";
import FlashbackOut from "./FlashbackOut";
import AttachCharacterShader from "./AttachCharacterShader";
import PlayScenarioEffect from "./PlayScenarioEffect";
import StopScenarioEffect from "./StopScenarioEffect";
import ShakeScreen from "./ShakeScreen";
import ShakeWindow from "./ShakeWindow";
import StopShakeScreen from "./StopShakeScreen";
import StopShakeWindow from "./StopShakeWindow";
import AmbientColorNormal from "./AmbientColorNormal";
import AmbientColorEvening from "./AmbientColorEvening";
import AmbientColorNight from "./AmbientColorNight";
import BlackWipeInLeft from "./BlackWipeInLeft";
import BlackWipeOutLeft from "./BlackWipeOutLeft";
import BlackWipeInRight from "./BlackWipeInRight";
import BlackWipeOutRight from "./BlackWipeOutRight";
import BlackWipeInTop from "./BlackWipeInTop";
import BlackWipeOutTop from "./BlackWipeOutTop";
import BlackWipeInBottom from "./BlackWipeInBottom";
import BlackWipeOutBottom from "./BlackWipeOutBottom";
import SekaiIn from "./SekaiIn";
import SekaiOut from "./SekaiOut";
import SimpleSelectable from "./SimpleSelectable";
import FullScreenText from "./FullScreenText";
import FullScreenTextShow from "./FullScreenTextShow";
import FullScreenTextHide from "./FullScreenTextHide";
import MemoryIn from "./MemoryIn";
import MemoryOut from "./MemoryOut";
import SekaiInCenter from "./SekaiInCenter";
import SekaiOutCenter from "./SekaiOutCenter";
import ChangeCameraPosition from "./ChangeCameraPosition";
import ChangeCameraZoomLevel from "./ChangeCameraZoomLevel";
import Movie from "./Movie";
import Blur from "./Blur";

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
  log.warn(
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
