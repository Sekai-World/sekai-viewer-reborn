import type { Live2DController } from "../Live2DController.js";
import type { Snippet } from "../../../model/scenario-types.js";
import { SnippetAction } from "../../../model/scenario-types.js";

import action_talk from "./talk.js";
import action_sound from "./sound.js";
import action_motion from "./character_motion.js";
import action_layout from "./character_layout.js";
import action_se from "./special_effect/index.js";
import action_layout_mode from "./action_layout_mode.js";

export default async function single_action(controller: Live2DController, action: Snippet) {
  switch (action.Action) {
    case SnippetAction.SpecialEffect:
      await action_se(controller, action);
      break;
    case SnippetAction.CharacterLayout:
      await action_layout(controller, action);
      break;
    case SnippetAction.CharacterMotion:
      await action_motion(controller, action);
      break;
    case SnippetAction.Talk:
      await action_talk(controller, action);
      break;
    case SnippetAction.Sound:
      await action_sound(controller, action);
      break;
    case SnippetAction.CharacterLayoutMode:
      await action_layout_mode(controller, action);
      break;
    default:
      controller.logger.warn(
        "Live2DController",
        `${SnippetAction[action.Action]} not implemented!`,
        action
      );
      controller.events.emit("warn", `${SnippetAction[action.Action]} not implemented!`);
  }
}
