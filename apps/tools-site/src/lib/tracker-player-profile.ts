import type { HonorDegreeInput } from "@platform/ui-shell";
import {
  toCatalogueBondsHonorDegree,
  toCatalogueHonorDegree,
  type BondsHonor,
  type BondsHonorViewData,
  type Honor
} from "@platform/ui-shell/honor-degree-adapter";
import { asObject, asPositiveInteger } from "$lib/honor-master";

/**
 * The card a ranked player shows as their avatar: the leader of their current deck.
 * The game picks the trained art only when `defaultImage` is `special_training`
 * (jp-6.7.0 `CardUtility.IsDefaultImage`), regardless of `specialTrainingStatus`.
 */
export type TrackerLeaderCard = { cardId: number; trained: boolean };

export type TrackerBondsHonorView = "normal" | "reverse" | "reverse_unit_virtual_singer" | string;

/** One title a player set on their profile; seq 1 is the main slot, 2 and 3 the sub slots. */
export type TrackerProfileHonor =
  | { kind: "normal"; seq: number; honorId: number; level: number | null }
  | {
      kind: "bonds";
      seq: number;
      honorId: number;
      level: number | null;
      wordId: number | null;
      view: TrackerBondsHonorView;
    };

/** Card metadata needed to draw an avatar, keyed by card ID in lookup responses. */
export type TrackerCardArt = {
  id: number;
  /** The card's title, used as the avatar's accessible name where it stands alone. */
  prefix: string | null;
  assetBundleName: string;
  attr: string | null;
  rarityType: string | null;
};

/** Master data for a player's titles, as returned by the tracker honor lookup. */
export type TrackerHonorLookup = {
  honors: Honor[];
  bondsHonors: BondsHonor[];
  bondsViewData: BondsHonorViewData | null;
};

/** Malformed or missing card data only hides the avatar; it never rejects the ranking row. */
export const parseLeaderCard = (value: unknown): TrackerLeaderCard | null => {
  const card = asObject(value);
  const cardId = asPositiveInteger(card?.cardId);
  return cardId === null ? null : { cardId, trained: card?.defaultImage === "special_training" };
};

const PROFILE_HONOR_SLOTS = 3;

/** Keeps the three profile slots in seq order; malformed entries are dropped. */
export const parseProfileHonors = (value: unknown): TrackerProfileHonor[] => {
  if (!Array.isArray(value)) return [];
  const bySeq = new Map<number, TrackerProfileHonor>();
  for (const entry of value) {
    const honor = asObject(entry);
    const seq = asPositiveInteger(honor?.seq);
    const honorId = asPositiveInteger(honor?.honorId);
    if (!honor || seq === null || seq > PROFILE_HONOR_SLOTS || honorId === null) continue;
    if (bySeq.has(seq)) continue;
    const level = asPositiveInteger(honor.honorLevel);
    if (honor.profileHonorType === "bonds") {
      bySeq.set(seq, {
        kind: "bonds",
        seq,
        honorId,
        level,
        wordId: asPositiveInteger(honor.bondsHonorWordId),
        view: typeof honor.bondsHonorViewType === "string" ? honor.bondsHonorViewType : "normal"
      });
    } else if (honor.profileHonorType === undefined || honor.profileHonorType === "normal") {
      bySeq.set(seq, { kind: "normal", seq, honorId, level });
    }
  }
  return [...bySeq.values()].toSorted((a, b) => a.seq - b.seq);
};

export type TrackerProfileHonorDegree = {
  seq: number;
  slot: "main" | "sub1" | "sub2";
  name: string | null;
  degree: HonorDegreeInput;
};

const slotFor = (seq: number): TrackerProfileHonorDegree["slot"] => {
  if (seq === 1) return "main";
  return seq === 2 ? "sub1" : "sub2";
};

const withLevel = <T extends { level?: number | null }>(degree: T, level: number | null): T =>
  level === null ? degree : { ...degree, level };

/**
 * A player's titles as the game's profile lays them out. Titles missing from the lookup
 * are left out rather than drawn empty.
 */
export const toProfileHonorDegrees = (
  profileHonors: readonly TrackerProfileHonor[],
  lookup: TrackerHonorLookup
): TrackerProfileHonorDegree[] =>
  profileHonors.flatMap((entry): TrackerProfileHonorDegree[] => {
    const slot = slotFor(entry.seq);
    const main = slot === "main";
    if (entry.kind === "bonds") {
      const honor = lookup.bondsHonors.find((candidate) => candidate.id === entry.honorId);
      if (!honor) return [];
      const view = {
        wordId: entry.wordId,
        reverse: entry.view.startsWith("reverse"),
        unitVirtualSinger: entry.view.endsWith("unit_virtual_singer")
      };
      const degrees = toCatalogueBondsHonorDegree(honor, view, lookup.bondsViewData);
      const degree = main ? degrees.main : degrees.sub;
      return [
        {
          seq: entry.seq,
          slot,
          name: honor.name,
          degree: degree.kind === "bonds" ? withLevel(degree, entry.level) : degree
        }
      ];
    }

    const honor = lookup.honors.find((candidate) => candidate.id === entry.honorId);
    if (!honor) return [];
    const group = honor.group ?? {
      id: honor.groupId,
      name: null,
      honorType: honor.honorType,
      backgroundAssetBundleName: null,
      frameName: null
    };
    const degrees = toCatalogueHonorDegree(honor, group, entry.level);
    return [{ seq: entry.seq, slot, name: honor.name, degree: main ? degrees.main : degrees.sub }];
  });
