import type { SharedStampListItemResponse } from "@platform/sekai-master-api-sdk";

export const stampFixtures: SharedStampListItemResponse[] = Array.from(
  { length: 42 },
  (_, index) => {
    const id = index + 1;
    const isFestivalStamp = index === 24;

    return {
      assetbundleName: `visual-stamp-${id}`,
      category: "character",
      characterIds: [1],
      ...(isFestivalStamp ? { description: "Awarded at the festival." } : {}),
      gameCharacterUnitId: 1,
      id,
      name: isFestivalStamp
        ? "[スタンプ]天馬咲希：Festival Afterglow"
        : `[スタンプ]星乃一歌：Practice Stamp ${String(id).padStart(2, "0")}`,
      stampType: "normal"
    };
  }
);
