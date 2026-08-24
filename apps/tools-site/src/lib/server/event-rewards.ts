import { getEventsByRegionByIdRewards } from "@platform/sekai-master-api-sdk";
import type { SharedEventRewardRangeResponse } from "@platform/sekai-master-api-sdk";
import type { TrackerRegion } from "./event-tracker";
import { withRequestTimeout } from "./network";
export type EventRewardsResult = {
  status: "available" | "sdk-error" | "network-error" | "invalid-data";
  items: SharedEventRewardRangeResponse[];
};
export const getEventRewards = async (baseUrl: string, region: TrackerRegion, eventId: number): Promise<EventRewardsResult> => {
  try {
    const response = await withRequestTimeout<Awaited<ReturnType<typeof getEventsByRegionByIdRewards>>>((signal) => getEventsByRegionByIdRewards({ baseUrl, path: { region, id: String(eventId) }, signal } as Parameters<typeof getEventsByRegionByIdRewards>[0]));
    if ("error" in response && response.error) return { status: "sdk-error", items: [] };
    const items = response.data?.items;
    return Array.isArray(items) ? { status: "available", items } : { status: "invalid-data", items: [] };
  } catch { return { status: "network-error", items: [] }; }
};
