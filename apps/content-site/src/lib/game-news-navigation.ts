import type { GameNewsTarget } from "$lib/server/game-news";

export const openGameNewsTarget = (
  target: GameNewsTarget,
  openInternal: (url: string) => void
): void => {
  if (target.kind === "internal") {
    openInternal(target.url);
    return;
  }

  if (target.kind === "external") {
    window.open(target.url, "_blank", "noopener,noreferrer");
  }
};
