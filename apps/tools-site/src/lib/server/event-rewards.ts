import { getEventsByRegionByIdRewards } from "@platform/sekai-master-api-sdk";
import type { TrackerRegion } from "./event-tracker";
export type EventRewardsResult = { status: "available" | "sdk-error" | "network-error" | "invalid-data"; rewardRangeCount: number };
export const getEventRewards = async (baseUrl: string, region: TrackerRegion, eventId: number): Promise<EventRewardsResult> => {
  try {
    const response = await getEventsByRegionByIdRewards({ baseUrl, path: { region, id: String(eventId) } });
    if (response.error) return { status: "sdk-error", rewardRangeCount: 0 };
    const items = response.data?.items;
    return Array.isArray(items) ? { status: "available", rewardRangeCount: items.length } : { status: "invalid-data", rewardRangeCount: 0 };
  } catch { return { status: "network-error", rewardRangeCount: 0 }; }
};
