import { error, json } from "@sveltejs/kit";
import { getCharacter3DsByRegionBatch, getVirtualLivesByRegionByIdSetlists } from "@platform/sekai-master-api-sdk";
import { getRemoteAssetEndpointURL } from "$lib/assets/index";
import {
  isPositiveSafeInteger,
  isSupportedVirtualLiveRegion
} from "$lib/domain/virtual-live-timeline";
import type { VirtualLiveTimelineCharacter, VirtualLiveTimelineDocument, VirtualLiveTimelineEvent } from "$lib/domain/virtual-live-timeline";
import type { SupportedRegion } from "$lib/domain/regions";
import { getInternalRemoteAssetBaseUrl, getMasterApiBaseUrl } from "$lib/server/config";
import {
  normalizeVirtualLiveMCScenario,
  normalizeVirtualLiveTimeline,
  VirtualLiveTimelineNormalizationError
} from "$lib/server/virtual-live-timeline";
import type { RequestHandler } from "./$types";

const MAX_TIMELINE_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;

type Character3DRecord = { id: number; gameCharacterId: number; unit?: string; name?: string };
const enrichTimeline = async (document: VirtualLiveTimelineDocument, baseUrl: string, region: SupportedRegion, bundle: string): Promise<VirtualLiveTimelineDocument> => {
  const documentWithVoices = {
    ...document,
    events: document.events.map((event) => {
      const cue = event.type === "talk" ? getString(event.attributes?.cueName) : null;
      return {
        ...event,
        voiceUrl: cue && /^[A-Za-z0-9_-]+$/.test(cue)
          ? getRemoteAssetEndpointURL(`virtual_live/mc/voice/${bundle}/${cue}.mp3`, region)
          : null
      };
    })
  };
  const ids = [...new Set(document.events.flatMap((event) => [event.character3dId, event.targetCharacter3dId]).filter((id): id is number => typeof id === "number" && id > 0))];
  if (ids.length === 0) return documentWithVoices;
  try {
    const response = await getCharacter3DsByRegionBatch({ baseUrl, path: { region }, query: { ids: ids.slice(0, 100).join(",") } });
    if (response.error) return documentWithVoices;
    const records = getObject(response.data)?.items;
    const byID = new Map<number, Character3DRecord>((Array.isArray(records) ? records : []).flatMap((value) => {
      const record = getObject(value); const id = getNumber(record?.id); const gameCharacterId = getNumber(record?.gameCharacterId);
      return id !== null && gameCharacterId !== null ? [[id, { id, gameCharacterId, unit: getString(record?.unit) ?? undefined, name: getString(record?.name) ?? undefined }]] : [];
    }));
    const enrich = <T extends VirtualLiveTimelineCharacter | VirtualLiveTimelineEvent>(value: T): T => {
      if (value.character3dId === null) return value;
      const record = byID.get(value.character3dId);
      const localName = "characterName" in value ? value.characterName : value.name;
      return record ? { ...value, gameCharacterId: record.gameCharacterId, unit: record.unit ?? null, displayName: localName ?? record.name ?? null } : value;
    };
    return {
      ...documentWithVoices,
      characters: documentWithVoices.characters.map(enrich),
      events: documentWithVoices.events.map((event) => {
        const enriched = enrich(event);
        const target = event.targetCharacter3dId === null ? null : byID.get(event.targetCharacter3dId);
        return { ...enriched, targetGameCharacterId: target?.gameCharacterId ?? null, targetDisplayName: target?.name ?? null };
      })
    };
  } catch {
    return documentWithVoices;
  }
};

const getObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const getNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const getString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const readLimitedJson = async (response: Response): Promise<unknown> => {
  const contentLength = getNumber(response.headers.get("content-length"));
  if (contentLength !== null && contentLength > MAX_TIMELINE_BYTES) throw error(413, "Timeline is too large");
  if (!response.body) throw error(502, "Timeline response has no body");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_TIMELINE_BYTES) {
      await reader.cancel();
      throw error(413, "Timeline is too large");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw error(502, "Timeline data is malformed");
  }
};

export const GET: RequestHandler = async ({ params, fetch }) => {
  const region = params.region?.trim() ?? "";
  const virtualLiveId = Number(params.id);
  const setlistId = Number(params.setlistId);
  if (!isSupportedVirtualLiveRegion(region) || !isPositiveSafeInteger(virtualLiveId) || !isPositiveSafeInteger(setlistId)) {
    throw error(400, "Invalid timeline request");
  }

  const setlistResponse = await getVirtualLivesByRegionByIdSetlists({
    baseUrl: getMasterApiBaseUrl(),
    path: { region, id: String(virtualLiveId) }
  });
  if (setlistResponse.error) throw error(502, "Unable to load the Virtual Live setlist");

  const items = getObject(setlistResponse.data)?.items;
  const setlist = (Array.isArray(items) ? items : [])
    .map(getObject)
    .find((item) => getNumber(item?.id) === setlistId);
  const setlistType = getString(setlist?.virtualLiveSetlistType);
  if (!setlist || (setlistType !== "mc" && setlistType !== "mc_timeline")) {
    throw error(404, "Timeline setlist not found");
  }

  const bundleName = getString(setlist.assetbundleName);
  if (!bundleName || !/^[A-Za-z0-9_-]+$/.test(bundleName)) throw error(404, "Timeline asset not found");
  const assetPath = setlistType === "mc"
    ? `virtual_live/mc/scenario/${bundleName}/${bundleName}.asset`
    : `virtual_live/mc/timeline/${bundleName}/${bundleName}.playable`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  const fetchAsset = async (): Promise<Response> =>
    fetch(getRemoteAssetEndpointURL(assetPath, region, getInternalRemoteAssetBaseUrl()), {
      signal: controller.signal,
      headers: { accept: "application/json" }
    });

  try {
    const response = await fetchAsset();
    if (response.status === 404) throw error(404, "Timeline asset not found");
    if (!response.ok) throw error(502, "Unable to load timeline asset");
    const payload = await readLimitedJson(response);
    const normalized = setlistType === "mc"
      ? normalizeVirtualLiveMCScenario(payload)
      : normalizeVirtualLiveTimeline(payload);
    const document = await enrichTimeline(normalized, getMasterApiBaseUrl(), region, bundleName);
    return json(document, {
      headers: {
        "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
        "x-content-type-options": "nosniff"
      }
    });
  } catch (cause) {
    if (cause instanceof VirtualLiveTimelineNormalizationError) {
      throw error(cause.code === "EVENT_LIMIT_EXCEEDED" ? 413 : 502, "Timeline data is malformed");
    }
    if (cause instanceof DOMException && cause.name === "AbortError") throw error(504, "Timeline request timed out");
    throw cause;
  } finally {
    clearTimeout(timeout);
  }
};
