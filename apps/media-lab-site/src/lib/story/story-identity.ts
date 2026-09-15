/**
 * Story identity codecs and pure resolution against raw master-data
 * collections (`sekai-master-db[-en|-tc|-kr|-cn]-diff`).
 *
 * Route `storyId` semantics per story type:
 * - unit:       `{unit}-{chapterNo}-{episodeNo}`   e.g. `idol-1-1`
 * - event:      `{eventId}-{episodeNo}`            e.g. `1-1`
 * - character:  `{characterId}`                    e.g. `1`
 * - card:       `{cardEpisodeId}`                  e.g. `1`
 * - area-talk:  `{actionSetId}`                    e.g. `1838`
 * - special:    `{specialStoryId}-{episodeNo}`     e.g. `2-1`
 */

import {
  areaTalkScenarioPath,
  cardStoryScenarioPath,
  characterProfileScenarioPath,
  eventStoryScenarioPath,
  specialStoryScenarioPath,
  unitStoryScenarioPath
} from "./story-urls";
import type { StoryRouteStoryType } from "$lib/live2d/story-route";

// ---------------------------------------------------------------------------
// Raw master-data shapes (story-relevant fields only)
// ---------------------------------------------------------------------------

export interface StoryUnitEpisode {
  id: number;
  chapterNo: number;
  episodeNo: number;
  episodeNoLabel?: string;
  title: string;
  assetbundleName: string;
  scenarioId: string;
  /** Unit story episode group (story line) this episode belongs to. */
  unitStoryEpisodeGroupId?: number;
  releaseConditionId?: number;
}

/**
 * Story line grouping for unit stories (`unitStoryEpisodeGroups.json`):
 * one `unitEpisodeCategory: "none"` group per regular unit, and five groups
 * for Virtual Singer — one per other unit's sekai, each with its `outline`.
 */
export interface StoryUnitEpisodeGroup {
  id: number;
  unit: string;
  unitEpisodeCategory: string;
  outline?: string;
  assetbundleName?: string;
}

export interface StoryUnitChapter {
  id: number;
  unit: string;
  chapterNo: number;
  title: string;
  assetbundleName: string;
  episodes: StoryUnitEpisode[];
}

export interface StoryUnitStory {
  unit: string;
  seq: number;
  chapters: StoryUnitChapter[];
}

export interface StoryEventEpisode {
  id: number;
  eventStoryId: number;
  episodeNo: number;
  title: string;
  assetbundleName: string;
  scenarioId: string;
  releaseConditionId?: number;
}

export interface StoryEventStory {
  id: number;
  eventId: number;
  assetbundleName: string;
  eventStoryEpisodes: StoryEventEpisode[];
}

export interface StoryEvent {
  id: number;
  name: string;
}

export interface StoryCharacterProfile {
  characterId: number;
  scenarioId: string;
}

export interface StoryCardEpisode {
  id: number;
  cardId: number;
  title: string;
  scenarioId: string;
  assetbundleName?: string;
  releaseConditionId?: number;
}

export interface StoryCard {
  id: number;
  characterId: number;
}

export interface StoryActionSet {
  id: number;
  areaId: number;
  scriptId?: string;
  scenarioId?: string;
}

export interface StorySpecialEpisode {
  id: number;
  episodeNo: number;
  title: string;
  assetbundleName: string;
  scenarioId: string;
}

export interface StorySpecialStory {
  id: number;
  title: string;
  assetbundleName: string;
  episodes: StorySpecialEpisode[];
}

export interface StoryGameCharacter {
  id: number;
  firstName: string;
  givenName: string;
}

export interface StoryUnitProfile {
  unit: string;
  /** In-game display name (e.g. "Leo/need", "25時、ナイトコードで。"). */
  unitName: string;
  seq?: number;
}

/** Master-data collections the story feature consumes. */
export interface StoryMasterCollections {
  unitStories: StoryUnitStory[];
  eventStories: StoryEventStory[];
  events?: StoryEvent[];
  characterProfiles: StoryCharacterProfile[];
  cardEpisodes: StoryCardEpisode[];
  actionSets: StoryActionSet[];
  specialStories: StorySpecialStory[];
  unitProfiles?: StoryUnitProfile[];
  unitStoryEpisodeGroups?: StoryUnitEpisodeGroup[];
}

// ---------------------------------------------------------------------------
// storyId codecs
// ---------------------------------------------------------------------------

export type ParsedStoryId =
  | { kind: "unit"; unit: string; chapterNo: number; episodeNo: number }
  | { kind: "event"; eventId: number; episodeNo: number }
  | { kind: "character"; characterId: number }
  | { kind: "card"; cardEpisodeId: number }
  | { kind: "area-talk"; actionSetId: number }
  | { kind: "special"; specialStoryId: number; episodeNo: number };

const parseNumberPart = (value: string | undefined): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
};

/** Parses a storyId for the given story type; `null` when malformed. */
export const parseStoryId = (
  storyType: StoryRouteStoryType,
  storyId: string
): ParsedStoryId | null => {
  const parts = storyId.split("-");
  switch (storyType) {
    case "unit": {
      if (parts.length !== 3) return null;
      const [unit, chapterNo, episodeNo] = parts;
      if (!unit) return null;
      const chapter = parseNumberPart(chapterNo);
      const episode = parseNumberPart(episodeNo);
      if (chapter === null || episode === null) return null;
      return { kind: "unit", unit, chapterNo: chapter, episodeNo: episode };
    }
    case "event": {
      if (parts.length !== 2) return null;
      const eventId = parseNumberPart(parts[0]);
      const episodeNo = parseNumberPart(parts[1]);
      if (eventId === null || episodeNo === null) return null;
      return { kind: "event", eventId, episodeNo };
    }
    case "character": {
      const characterId = parseNumberPart(storyId);
      return characterId === null ? null : { kind: "character", characterId };
    }
    case "card": {
      const cardEpisodeId = parseNumberPart(storyId);
      return cardEpisodeId === null ? null : { kind: "card", cardEpisodeId };
    }
    case "area-talk": {
      const actionSetId = parseNumberPart(storyId);
      return actionSetId === null ? null : { kind: "area-talk", actionSetId };
    }
    case "special": {
      if (parts.length !== 2) return null;
      const specialStoryId = parseNumberPart(parts[0]);
      const episodeNo = parseNumberPart(parts[1]);
      if (specialStoryId === null || episodeNo === null) return null;
      return { kind: "special", specialStoryId, episodeNo };
    }
    default:
      return null;
  }
};

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

export interface StoryResolution {
  /** Bucket-relative scenario JSON path. */
  scenarioPath: string;
  isCardStory: boolean;
  isActionSet: boolean;
  /** Bucket-relative banner image path, when the story type has one. */
  bannerPath?: string;
  chapterTitle?: string;
  episodeTitle?: string;
  /** The scenario id of the resolved episode (used for voice bundles). */
  scenarioId: string;
}

/** Bucket-relative banner image for a unit story episode. */
export const unitEpisodeBannerPath = (
  chapterAssetbundleName: string,
  episodeAssetbundleName: string
): string => `story/episode_image/${chapterAssetbundleName}/${episodeAssetbundleName}.webp`;

export type StoryResolutionResult =
  | { status: "ok"; resolution: StoryResolution }
  | { status: "not-found" }
  | { status: "unsupported"; reason: string };

/**
 * Resolves a validated route identity against the story's master-data
 * collections. Pure: no network access.
 */
export const resolveStoryIdentity = (
  storyType: StoryRouteStoryType,
  storyId: string,
  collections: StoryMasterCollections,
  region: string
): StoryResolutionResult => {
  const parsed = parseStoryId(storyType, storyId);
  if (!parsed) return { status: "unsupported", reason: "malformed story id" };

  switch (parsed.kind) {
    case "unit": {
      const unit = collections.unitStories.find((us) => us.unit === parsed.unit);
      const chapter = unit?.chapters.find((ch) => ch.chapterNo === parsed.chapterNo);
      const episode = chapter?.episodes.find((ep) => ep.episodeNo === parsed.episodeNo);
      if (!unit || !chapter || !episode) return { status: "not-found" };
      return {
        status: "ok",
        resolution: {
          scenarioPath: unitStoryScenarioPath(chapter.assetbundleName, episode.scenarioId),
          isCardStory: false,
          isActionSet: false,
          bannerPath: unitEpisodeBannerPath(chapter.assetbundleName, episode.assetbundleName),
          chapterTitle: chapter.title,
          episodeTitle: episode.title,
          scenarioId: episode.scenarioId
        }
      };
    }
    case "event": {
      const eventStory = collections.eventStories.find(
        (es) => es.eventId === parsed.eventId
      );
      const episode = eventStory?.eventStoryEpisodes.find(
        (ep) => ep.episodeNo === parsed.episodeNo
      );
      if (!eventStory || !episode) return { status: "not-found" };
      const eventName = collections.events?.find((e) => e.id === parsed.eventId)?.name;
      return {
        status: "ok",
        resolution: {
          scenarioPath: eventStoryScenarioPath(eventStory.assetbundleName, episode.scenarioId),
          isCardStory: false,
          isActionSet: false,
          bannerPath: `event_story/${eventStory.assetbundleName}/episode_image/${episode.assetbundleName}.webp`,
          chapterTitle: eventName ?? "",
          episodeTitle: episode.title,
          scenarioId: episode.scenarioId
        }
      };
    }
    case "character": {
      const profile = collections.characterProfiles.find(
        (cp) => cp.characterId === parsed.characterId
      );
      if (!profile) return { status: "not-found" };
      return {
        status: "ok",
        resolution: {
          scenarioPath: characterProfileScenarioPath(profile.scenarioId),
          isCardStory: false,
          isActionSet: false,
          episodeTitle: undefined,
          scenarioId: profile.scenarioId
        }
      };
    }
    case "card": {
      const episode = collections.cardEpisodes.find((ce) => ce.id === parsed.cardEpisodeId);
      if (!episode) return { status: "not-found" };
      if (!episode.assetbundleName) {
        return { status: "unsupported", reason: "card episode has no asset bundle" };
      }
      return {
        status: "ok",
        resolution: {
          scenarioPath: cardStoryScenarioPath(episode.assetbundleName, episode.scenarioId, region as "jp"),
          isCardStory: true,
          isActionSet: false,
          bannerPath: `character/member_small/${episode.assetbundleName}/card_normal.webp`,
          episodeTitle: episode.title,
          scenarioId: episode.scenarioId
        }
      };
    }
    case "area-talk": {
      const actionSet = collections.actionSets.find((as) => as.id === parsed.actionSetId);
      if (!actionSet) return { status: "not-found" };
      if (!actionSet.scenarioId) {
        return { status: "unsupported", reason: "action set has no scenario" };
      }
      return {
        status: "ok",
        resolution: {
          scenarioPath: areaTalkScenarioPath(actionSet.id, actionSet.scenarioId),
          isCardStory: false,
          isActionSet: true,
          scenarioId: actionSet.scenarioId
        }
      };
    }
    case "special": {
      const story = collections.specialStories.find((sp) => sp.id === parsed.specialStoryId);
      const episode = story?.episodes.find((ep) => ep.episodeNo === parsed.episodeNo);
      if (!story || !episode) return { status: "not-found" };
      return {
        status: "ok",
        resolution: {
          scenarioPath: specialStoryScenarioPath(
            story.assetbundleName,
            episode.assetbundleName,
            episode.scenarioId
          ),
          isCardStory: false,
          isActionSet: false,
          chapterTitle: story.title,
          episodeTitle: episode.title,
          scenarioId: episode.scenarioId
        }
      };
    }
  }
};

// ---------------------------------------------------------------------------
// Catalog (selector lists)
// ---------------------------------------------------------------------------

export interface StoryCatalogItem {
  storyId: string;
  label: string;
  sublabel?: string;
}

export interface StoryCatalogGroup {
  key: string;
  label: string;
  items: StoryCatalogItem[];
}

/**
 * Builds the slim story list for one story type. Raw master-data titles are
 * shown as-is (they are game data); groups give the selector structure.
 */
export const buildStoryCatalog = (
  storyType: StoryRouteStoryType,
  collections: StoryMasterCollections
): StoryCatalogGroup[] => {
  switch (storyType) {
    case "unit":
      return collections.unitStories
        .slice()
        .sort((a, b) => a.seq - b.seq)
        .map((unit) => ({
          key: unit.unit,
          // Group by the in-game unit name; fall back to the raw slug when
          // the unitProfiles table has not been fetched for this region.
          label:
            collections.unitProfiles?.find((profile) => profile.unit === unit.unit)?.unitName ??
            unit.unit,
          items: unit.chapters
            .slice()
            .sort((a, b) => a.chapterNo - b.chapterNo)
            .flatMap((chapter) =>
              chapter.episodes
                .slice()
                .sort((a, b) => a.episodeNo - b.episodeNo)
                .map((episode) => ({
                  storyId: `${unit.unit}-${chapter.chapterNo}-${episode.episodeNo}`,
                  label: episode.title,
                  // In-game episode label (第1話 / Episode 1); the raw
                  // episodeNo stays in the storyId slug only.
                  sublabel: episode.episodeNoLabel ?? String(episode.episodeNo)
                }))
            )
        }));
    case "event":
      return collections.eventStories
        .slice()
        .sort((a, b) => a.eventId - b.eventId)
        .map((eventStory) => {
          const eventName =
            collections.events?.find((e) => e.id === eventStory.eventId)?.name ??
            `#${eventStory.eventId}`;
          return {
            key: String(eventStory.eventId),
            label: eventName,
            items: eventStory.eventStoryEpisodes
              .slice()
              .sort((a, b) => a.episodeNo - b.episodeNo)
              .map((episode) => ({
                storyId: `${eventStory.eventId}-${episode.episodeNo}`,
                label: episode.title,
                sublabel: String(episode.episodeNo)
              }))
          };
        });
    case "character":
      return [
        {
          key: "character",
          label: "character",
          items: collections.characterProfiles
            .slice()
            .sort((a, b) => a.characterId - b.characterId)
            .map((profile) => ({
              storyId: String(profile.characterId),
              label: `#${profile.characterId}`
            }))
        }
      ];
    case "card": {
      const groups = new Map<number, StoryCatalogItem[]>();
      for (const episode of collections.cardEpisodes) {
        const bucket = Math.floor(episode.cardId / 100) * 100;
        const items = groups.get(bucket) ?? [];
        items.push({
          storyId: String(episode.id),
          label: episode.title,
          sublabel: `#${episode.cardId}`
        });
        groups.set(bucket, items);
      }
      return Array.from(groups.entries())
        .sort(([a], [b]) => a - b)
        .map(([bucket, items]) => ({
          key: String(bucket),
          label: `#${bucket}+`,
          items
        }));
    }
    case "area-talk": {
      const groups = new Map<number, StoryCatalogItem[]>();
      for (const actionSet of collections.actionSets) {
        if (!actionSet.scenarioId) continue;
        const items = groups.get(actionSet.areaId) ?? [];
        items.push({
          storyId: String(actionSet.id),
          label: actionSet.scriptId ?? actionSet.scenarioId,
          sublabel: String(actionSet.id)
        });
        groups.set(actionSet.areaId, items);
      }
      return Array.from(groups.entries())
        .sort(([a], [b]) => a - b)
        .map(([areaId, items]) => ({
          key: String(areaId),
          label: String(areaId),
          items
        }));
    }
    case "special":
      return collections.specialStories
        .slice()
        .sort((a, b) => a.id - b.id)
        .map((story) => ({
          key: String(story.id),
          label: story.title,
          items: story.episodes
            .slice()
            .sort((a, b) => a.episodeNo - b.episodeNo)
            .map((episode) => ({
              storyId: `${story.id}-${episode.episodeNo}`,
              label: episode.title,
              sublabel: String(episode.episodeNo)
            }))
        }));
    default:
      return [];
  }
};

// ---------------------------------------------------------------------------
// Unit story catalog (story picker)
// ---------------------------------------------------------------------------

/** One episode card in the unit story picker. */
export interface StoryUnitEpisodeCard {
  storyId: string;
  title: string;
  /** In-game episode label (第1話 / Episode 1); episodeNo otherwise. */
  sublabel?: string;
  /** Bucket-relative banner image path. */
  bannerPath: string;
}

/** A story line within a unit: its outline and episode cards. */
export interface StoryUnitEpisodeGroupCard {
  groupId: number;
  /** `"none"` for a regular unit's main line; otherwise the unit slug whose
   * sekai the Virtual Singer line is set in. */
  categoryUnit: string;
  outline?: string;
  episodes: StoryUnitEpisodeCard[];
}

/** A unit entry in the story picker: icon/name plus its story lines. */
export interface StoryUnitCatalogEntry {
  unit: string;
  unitName: string;
  groups: StoryUnitEpisodeGroupCard[];
}

/**
 * Groups a unit's episodes into story lines via `unitStoryEpisodeGroupId`
 * and the `unitStoryEpisodeGroups` collection (Virtual Singer resolves to
 * five lines, one per other unit's sekai; regular units to a single main
 * line). Falls back to one synthetic line when the collection is missing.
 */
export const buildUnitStoryCatalog = (
  collections: StoryMasterCollections
): StoryUnitCatalogEntry[] => {
  const unitNameBySlug = new Map(
    (collections.unitProfiles ?? []).map((profile) => [profile.unit, profile.unitName])
  );

  return collections.unitStories
    .slice()
    .sort((a, b) => a.seq - b.seq)
    .map((unitStory) => {
      const groupRows = (collections.unitStoryEpisodeGroups ?? [])
        .filter((group) => group.unit === unitStory.unit)
        .slice()
        .sort((a, b) => a.id - b.id);

      const episodesByGroupId = new Map<number, StoryUnitEpisodeCard[]>();
      for (const chapter of unitStory.chapters.slice().sort((a, b) => a.chapterNo - b.chapterNo)) {
        for (const episode of chapter.episodes.slice().sort((a, b) => a.episodeNo - b.episodeNo)) {
          const groupId = episode.unitStoryEpisodeGroupId ?? 0;
          const cards = episodesByGroupId.get(groupId) ?? [];
          cards.push({
            storyId: `${unitStory.unit}-${chapter.chapterNo}-${episode.episodeNo}`,
            title: episode.title,
            sublabel: episode.episodeNoLabel ?? String(episode.episodeNo),
            bannerPath: unitEpisodeBannerPath(chapter.assetbundleName, episode.assetbundleName)
          });
          episodesByGroupId.set(groupId, cards);
        }
      }

      const toGroupCard = (
        groupId: number,
        categoryUnit: string,
        outline?: string
      ): StoryUnitEpisodeGroupCard => ({
        groupId,
        categoryUnit,
        ...(outline ? { outline } : {}),
        episodes: episodesByGroupId.get(groupId) ?? []
      });

      const groups =
        groupRows.length > 0
          ? groupRows.map((row) => toGroupCard(row.id, row.unitEpisodeCategory, row.outline))
          : [
              {
                groupId: 0,
                categoryUnit: "none",
                episodes: Array.from(episodesByGroupId.values()).flat()
              }
            ];

      return {
        unit: unitStory.unit,
        unitName: unitNameBySlug.get(unitStory.unit) ?? unitStory.unit,
        groups: groups.filter((group) => group.episodes.length > 0)
      };
    });
};
