import type { Live2DController } from "../../Live2DController";
import type { Snippet } from "../../../scenario-types";

/**
 * Parses the SimpleSelectable payload — choice labels wrapped in 『』 and
 * joined with `/` (e.g. `『もちろん！』/『いつでも見守ってるよ』`).
 */
export const parseSimpleSelectableChoices = (stringVal: string): string[] =>
  stringVal
    .split("/")
    .map((choice) => choice.trim().replace(/^『/, "").replace(/』$/, "").trim())
    .filter((choice) => choice.length > 0);

/**
 * SimpleSelectable marks an in-story choice prompt. These stories carry no
 * branching data, so the effect only surfaces the choice labels to the host
 * UI: playback parks on this checkpoint (is_stop) until the viewer picks
 * one. Silent replays (prev) pass through without emitting.
 */
export default async function SimpleSelectable(
  controller: Live2DController,
  action: Snippet
): Promise<void> {
  if (controller.replay_silent) return;
  const detail = controller.scenarioData.SpecialEffectData[action.ReferenceIndex];
  controller.events.emit("selectable", parseSimpleSelectableChoices(detail.StringVal));
}
