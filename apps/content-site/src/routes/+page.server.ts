import { getEventsByRegionCurrent } from "@platform/sekai-master-api-sdk";
import {
  getContentSiteServerText,
  regionLabels,
  supportedRegions,
  type SupportedRegion
} from "@platform/i18n-dicts";
import { getMasterApiBaseUrl } from "$lib/server/config";
import { normalizeUiLocale, UI_LOCALE_COOKIE_NAME } from "$lib/region";
import type { PageServerLoad } from "./$types";

type EventSummary = {
  id: string;
  title: string;
  startAt: string | number | null;
  endAt: string | number | null;
  assetBundleName: string | null;
};

type RegionEventCard = {
  region: SupportedRegion;
  label: string;
  event: EventSummary | null;
  error: string | null;
};

const getString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

const getStringLike = (value: unknown): string | null => {
  const stringValue = getString(value);
  if (stringValue) {
    return stringValue;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
};

const getDateValue = (value: unknown): string | number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return getString(value);
};

const getObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;

const getNestedObject = (
  source: Record<string, unknown>,
  keys: readonly string[]
): Record<string, unknown> | null => {
  for (const key of keys) {
    const nested = getObject(source[key]);
    if (nested) {
      return nested;
    }
  }

  return null;
};

const pickFirstString = (
  source: Record<string, unknown>,
  keys: readonly string[]
): string | null => {
  for (const key of keys) {
    const value = getString(source[key]);
    if (value) {
      return value;
    }
  }

  return null;
};

const pickFirstStringLike = (
  source: Record<string, unknown>,
  keys: readonly string[]
): string | null => {
  for (const key of keys) {
    const value = getStringLike(source[key]);
    if (value) {
      return value;
    }
  }

  return null;
};

const pickFirstDateValue = (
  source: Record<string, unknown>,
  keys: readonly string[]
): string | number | null => {
  for (const key of keys) {
    const value = getDateValue(source[key]);
    if (value !== null) {
      return value;
    }
  }

  return null;
};

const parseEventSummary = (payload: unknown): EventSummary | null => {
  const root = getObject(payload);

  if (!root) {
    return null;
  }

  const eventNode = getNestedObject(root, ["event", "currentEvent", "data"]) ?? root;
  const id = pickFirstStringLike(eventNode, ["id", "eventId"]);
  const title = pickFirstString(eventNode, ["name", "title", "eventName"]);

  if (!id || !title) {
    return null;
  }

  return {
    id,
    title,
    startAt: pickFirstDateValue(eventNode, ["startAt", "start_at", "startDate"]),
    endAt: pickFirstDateValue(eventNode, ["aggregateAt", "aggregate_at", "endAt", "end_at", "endDate"]),
    assetBundleName: pickFirstString(eventNode, ["assetbundleName", "assetBundleName"])
  };
};

const toRegionEventCard = async (
  baseUrl: string,
  region: SupportedRegion,
  unavailableErrorText: string
): Promise<RegionEventCard> => {
  const response = await getEventsByRegionCurrent({
    baseUrl,
    path: { region }
  });

  if (response.error) {
    return {
      region,
      label: regionLabels[region],
      event: null,
      error: unavailableErrorText
    };
  }

  return {
    region,
    label: regionLabels[region],
    event: parseEventSummary(response.data),
    error: null
  };
};

export const load: PageServerLoad = async ({ cookies }) => {
  const uiLocale = normalizeUiLocale(cookies.get(UI_LOCALE_COOKIE_NAME));
  const homeEventDataUnavailable = getContentSiteServerText(
    uiLocale,
    "homeEventDataUnavailable"
  );
  const homeEventDataRequestFailed = getContentSiteServerText(
    uiLocale,
    "homeEventDataRequestFailed"
  );
  const baseUrl = getMasterApiBaseUrl();
  const cards = await Promise.all(
    supportedRegions.map(async (region) => {
      try {
        return await toRegionEventCard(baseUrl, region, homeEventDataUnavailable);
      } catch {
        return {
          region,
          label: regionLabels[region],
          event: null,
          error: homeEventDataRequestFailed
        } satisfies RegionEventCard;
      }
    })
  );

  return {
    cards
  };
};
