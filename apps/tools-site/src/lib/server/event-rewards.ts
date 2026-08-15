import { getEventsByRegionByIdRewards } from "@platform/sekai-master-api-sdk";
import type { SharedEventRewardRangeResponse } from "@platform/sekai-master-api-sdk";
import type { TrackerRegion } from "./event-tracker";
export type EventRewardsResult = {
  status: "available" | "sdk-error" | "network-error" | "invalid-data";
  items: SharedEventRewardRangeResponse[];
};
export const getEventRewards = async (baseUrl: string, region: TrackerRegion, eventId: number): Promise<EventRewardsResult> => {
  try {
    const response = await getEventsByRegionByIdRewards({ baseUrl, path: { region, id: String(eventId) } });
    if (response.error) return { status: "sdk-error", items: [] };
    const items = response.data?.items;
    return Array.isArray(items) ? { status: "available", items } : { status: "invalid-data", items: [] };
  } catch { return { status: "network-error", items: [] }; }
};
