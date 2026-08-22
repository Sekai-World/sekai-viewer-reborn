import { error } from "@sveltejs/kit";
import { getMasterApiBaseUrl, getSekaiApiBaseUrl } from "$lib/server/config";
import { getEventCatalog } from "$lib/server/event-catalog";
import { getEventRewards } from "$lib/server/event-rewards";
import { getChapterTrackerRankings, type ChapterTrackerResult } from "$lib/server/chapter-tracker";
import { getWorldBloomMetadata, type WorldBloomMetadata } from "$lib/server/world-bloom";
import {
  getEventTrackerRankings,
  isTrackerRegion,
  type EventTrackerResult
} from "$lib/server/event-tracker";
import type { PageServerLoad } from "./$types";

const parseEventId = (value: string | null): number | null | "invalid" => {
  if (value === null) return null;
  const eventId = Number(value);
  return Number.isSafeInteger(eventId) && eventId > 0 ? eventId : "invalid";
};

export const load: PageServerLoad = async ({ params, url, depends }) => {
  if (!isTrackerRegion(params.region)) {
    error(404, "Region not found");
  }

  const region = params.region;
  depends?.("tools-site:tracker:rankings");
  const eventId = parseEventId(url.searchParams.get("eventId"));
  if (eventId === "invalid") {
    return {
      region,
      selection: { mode: "history" as const, eventId: null },
      selectionStatus: "invalid-event-id" as const,
      trackerResult: Promise.resolve({
        selection: { mode: "history" as const, eventId: 0 },
        resolvedCurrentEventId: null,
        status: "invalid-data" as const,
        loadedAt: new Date().toISOString(),
        rankings: []
      } satisfies EventTrackerResult),
      catalog: Promise.resolve(null),
      rewards: Promise.resolve(null),
      chapters: Promise.resolve(null),
      isWorldBloom: false
    };
  }

  const trackerResult = getEventTrackerRankings(getSekaiApiBaseUrl(), region, eventId ?? undefined);
  depends?.("tools-site:tracker:catalog");
  const catalog = getEventCatalog(getMasterApiBaseUrl(), region, eventId ?? undefined);
  const worldBloom = getWorldBloomMetadata(getMasterApiBaseUrl(), region);
  const rewards = (async () => {
    const result = await trackerResult;
    const resolvedFromRankings = eventId ?? result.resolvedCurrentEventId;
    if (resolvedFromRankings !== null && resolvedFromRankings !== undefined) {
      return getEventRewards(getMasterApiBaseUrl(), region, resolvedFromRankings);
    }
    const catalogResult = await catalog;
    const resolvedFromCatalog = eventId ?? catalogResult.currentEvent?.id;
    return resolvedFromCatalog === undefined
      ? null
      : getEventRewards(getMasterApiBaseUrl(), region, resolvedFromCatalog);
  })();
  const chapters = (async (): Promise<{
    metadata: WorldBloomMetadata | null;
    rankings: Array<{ chapter: WorldBloomMetadata["chapters"][number]; result: ChapterTrackerResult }>;
  } | null> => {
    const [result, catalogResult, bloomResult] = await Promise.all([trackerResult, catalog, worldBloom]);
    const resolvedEventId = eventId ?? result.resolvedCurrentEventId ?? catalogResult.currentEvent?.id;
    if (resolvedEventId === undefined || bloomResult.status !== "available") return null;
    const metadata = bloomResult.items.find((item) => item.eventId === resolvedEventId) ?? null;
    if (!metadata) return null;
    const currentEventId = catalogResult.currentEvent?.id ?? result.resolvedCurrentEventId ?? null;
    const isCurrentEvent = currentEventId === resolvedEventId;
    const rankings = await Promise.all(
      metadata.chapters.map(async (chapter) => ({
        chapter,
        result: await getChapterTrackerRankings(
          getSekaiApiBaseUrl(),
          region,
          chapter.gameCharacterId,
          isCurrentEvent ? undefined : resolvedEventId
        )
      }))
    );
    return { metadata, rankings };
  })();
  // World Link identity must be known in the initial SSR payload so its
  // heading and tab bar are present on first paint without reserving space
  // for ordinary events.
  const isWorldBloom = await Promise.all([trackerResult, catalog, worldBloom]).then(
    ([result, catalogResult, bloomResult]) => {
      const resolvedEventId = eventId ?? result.resolvedCurrentEventId ?? catalogResult.currentEvent?.id;
      return resolvedEventId !== undefined &&
        bloomResult.status === "available" &&
        bloomResult.items.some((item) => item.eventId === resolvedEventId);
    },
    () => false
  );
  // Keep rankings unresolved so SvelteKit can send the page shell immediately.
  // The page deliberately renders a shape-matched skeleton until this settles.
  trackerResult.catch(() => {});
  catalog.catch(() => {});
  rewards.catch(() => {});
  worldBloom.catch(() => {});
  chapters.catch(() => {});

  return {
    region,
    selection:
      eventId === null
        ? ({ mode: "live", eventId: null } as const)
        : ({ mode: "history", eventId } as const),
    selectionStatus: "valid" as const,
    trackerResult: trackerResult as Promise<EventTrackerResult>,
    catalog,
    rewards,
    chapters,
    isWorldBloom
  };
};
