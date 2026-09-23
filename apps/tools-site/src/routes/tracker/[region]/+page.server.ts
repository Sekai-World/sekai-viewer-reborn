import { error } from "@sveltejs/kit";
import { getMasterApiBaseUrl, getSekaiApiBaseUrl } from "$lib/server/config";
import { getEventMetadata, type EventMetadataResult } from "$lib/server/event-catalog";
import { getEventRewards } from "$lib/server/event-rewards";
import { getChapterTrackerRankings, type ChapterTrackerResult } from "$lib/server/chapter-tracker";
import { getWorldBloomMetadata, type WorldBloomMetadata } from "$lib/server/world-bloom";
import {
  getEventTrackerRankings,
  isTrackerRegion,
  type EventTrackerResult
} from "$lib/server/event-tracker";
import type { PageServerLoad } from "./$types";

type TrackerPageReady = {
  catalog: EventMetadataResult | null;
  trackerResult: EventTrackerResult;
  resolvedEventId: number | null;
};

const parseEventId = (value: string | null): number | null | "invalid" => {
  if (value === null) return null;
  const eventId = Number(value);
  return Number.isSafeInteger(eventId) && eventId > 0 ? eventId : "invalid";
};

const resolveCatalogSelection = (
  catalogResult: EventMetadataResult,
  selectedEventId: number | null
): EventMetadataResult => {
  const currentEvent = catalogResult.currentEvent;
  if (
    selectedEventId === null ||
    currentEvent === null ||
    currentEvent.id !== selectedEventId ||
    catalogResult.selectedEvent !== null
  ) {
    return catalogResult;
  }

  // The current endpoint can remain available while the by-id endpoint briefly
  // reports that the region is updating. For an identical explicit selection,
  // keep the current event metadata usable without hiding historical failures.
  return {
    ...catalogResult,
    status: "available",
    selectedStatus: "available",
    selectedEvent: currentEvent
  };
};

export const load: PageServerLoad = async ({ params, url, depends }) => {
  if (!isTrackerRegion(params.region)) {
    error(404, "Region not found");
  }

  const region = params.region;
  const apiBaseUrl = getSekaiApiBaseUrl();
  const masterBaseUrl = getMasterApiBaseUrl();
  depends?.("tools-site:tracker:rankings");
  const eventId = parseEventId(url.searchParams.get("eventId"));
  if (eventId === "invalid") {
    return {
      region,
      selection: { mode: "history" as const, eventId: null },
      selectionStatus: "invalid-event-id" as const,
      trackerResult: Promise.resolve({
        selection: { mode: "live" as const, eventId: null },
        status: "invalid-data" as const,
        loadedAt: null,
        rankings: []
      } satisfies EventTrackerResult),
      catalog: Promise.resolve(null),
      trackerReady: Promise.resolve({
        catalog: null,
        trackerResult: {
          selection: { mode: "live" as const, eventId: null },
          status: "invalid-data" as const,
          loadedAt: null,
          rankings: []
        },
        resolvedEventId: null
      } satisfies TrackerPageReady),
      rewards: Promise.resolve(null),
      chapters: Promise.resolve(null),
      isWorldBloom: false
    };
  }

  depends?.("tools-site:tracker:metadata");
  const catalog = getEventMetadata(masterBaseUrl, region, eventId ?? undefined).then(
    (catalogResult) => resolveCatalogSelection(catalogResult, eventId)
  );
  const trackerResult =
    eventId === null
      ? getEventTrackerRankings(apiBaseUrl, region)
      : catalog.then(
          (catalogResult) =>
            getEventTrackerRankings(
              apiBaseUrl,
              region,
              catalogResult.currentEvent?.id === eventId ? undefined : eventId
            ),
          () => getEventTrackerRankings(apiBaseUrl, region, eventId)
        );
  const trackerReady = Promise.all([catalog, trackerResult]).then(
    ([catalogResult, result]): TrackerPageReady => ({
      catalog: catalogResult,
      trackerResult: result,
      // Live identity comes from the current-event endpoint. Ranking event IDs
      // are not metadata and must not be used to manufacture a current event.
      resolvedEventId: catalogResult.currentEvent?.id ?? null
    })
  );
  const worldBloom = getWorldBloomMetadata(masterBaseUrl, region);
  const rewards = (async () => {
    const catalogResult = await catalog;
    const resolvedEventId = eventId ?? catalogResult.currentEvent?.id;
    return resolvedEventId === undefined || resolvedEventId === null
      ? null
      : getEventRewards(masterBaseUrl, region, resolvedEventId);
  })();
  const chapters = (async (): Promise<{
    metadata: WorldBloomMetadata | null;
    rankings: Array<{
      chapter: WorldBloomMetadata["chapters"][number];
      result: ChapterTrackerResult;
    }>;
  } | null> => {
    const [catalogResult, bloomResult] = await Promise.all([catalog, worldBloom]);
    const resolvedEventId = eventId ?? catalogResult.currentEvent?.id;
    if (
      resolvedEventId === undefined ||
      resolvedEventId === null ||
      bloomResult.status !== "available"
    )
      return null;
    const metadata = bloomResult.items.find((item) => item.eventId === resolvedEventId) ?? null;
    if (!metadata) return null;
    const currentEventId = catalogResult.currentEvent?.id ?? null;
    const isCurrentEvent = currentEventId === resolvedEventId;
    const rankings = await Promise.all(
      metadata.chapters.map(async (chapter) => ({
        chapter,
        result: await getChapterTrackerRankings(
          apiBaseUrl,
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
  const isWorldBloom = Promise.all([catalog, worldBloom]).then(
    ([catalogResult, bloomResult]) => {
      const resolvedEventId = eventId ?? catalogResult.currentEvent?.id;
      return (
        resolvedEventId !== undefined &&
        bloomResult.status === "available" &&
        bloomResult.items.some((item) => item.eventId === resolvedEventId)
      );
    },
    () => false
  );
  // Keep rankings unresolved so SvelteKit can send the page shell immediately.
  // The page deliberately renders a shape-matched skeleton until this settles.
  trackerResult.catch(() => {});
  catalog.catch(() => {});
  trackerReady.catch(() => {});
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
    trackerReady,
    rewards,
    chapters,
    isWorldBloom
  };
};
