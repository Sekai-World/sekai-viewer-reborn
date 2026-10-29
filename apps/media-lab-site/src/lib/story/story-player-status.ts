import type { StoryPlayerSessionState } from "./story-player-session";

/**
 * Presentation-level player phase. The session only reports its engine state;
 * the host adds what the page layer knows: whether the user asked to load,
 * and whether playback has started (a `ready` engine before the first step is
 * waiting for the story to begin, afterwards it is parked at a checkpoint
 * waiting for the user's next input).
 */
export type StoryPlayerPhase =
  "idle" | "loading" | "ready" | "playing" | "waiting" | "finished" | "error";

export interface StoryPlayerStatus {
  phase: StoryPlayerPhase;
  /** Non-fatal playback warnings exist; independent of the phase. */
  warning: boolean;
}

export interface StoryPlayerStatusInput {
  loadStarted: boolean;
  sessionState: StoryPlayerSessionState;
  loadFailed: boolean;
  hasStarted: boolean;
  warningCount: number;
}

const phaseFor = ({
  loadStarted,
  sessionState,
  loadFailed,
  hasStarted
}: StoryPlayerStatusInput): StoryPlayerPhase => {
  if (!loadStarted) return "idle";
  if (loadFailed || sessionState === "error") return "error";
  switch (sessionState) {
    case "loading":
      return "loading";
    case "playing":
      return "playing";
    case "finished":
      return "finished";
    case "ready":
      return hasStarted ? "waiting" : "ready";
    default:
      // "destroyed": the session is gone, so the stage is back to its start.
      return "idle";
  }
};

export const deriveStoryPlayerStatus = (input: StoryPlayerStatusInput): StoryPlayerStatus => ({
  phase: phaseFor(input),
  warning: input.warningCount > 0
});
