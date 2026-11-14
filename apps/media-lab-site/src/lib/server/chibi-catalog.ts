import { SEKAI_MASTER_API_BASE_URL } from "$app/env/private";
import { getCostume2DsByRegionList } from "@platform/sekai-master-api-sdk";
import type {
  ChibiCatalog,
  ChibiCatalogCharacter,
  ChibiCatalogModel
} from "#lib/chibi/chibi-catalog.js";
import { resolveChibiModelDescriptor, type ChibiModelRegion } from "#lib/chibi/chibi-model.js";
import { resolveLive2dCharacterData } from "#lib/server/live2d-characters.js";

const CHIBI_CATALOG_REGION: ChibiModelRegion = "jp";
const PAGE_SIZE = 100;
/** JP has four pages today; the cap only bounds a misbehaving API. */
const MAX_PAGES = 20;

type CatalogRow = { readonly modelName: string; readonly character2dId: number | null };

const resolveMasterApiBaseUrl = (): string | null => {
  const value = SEKAI_MASTER_API_BASE_URL?.trim().replace(/\/+$/, "");
  return value ? value : null;
};

const readPage = async (baseUrl: string, fetcher: typeof fetch, page: number) => {
  const response = await getCostume2DsByRegionList({
    baseUrl,
    fetch: fetcher,
    path: { region: CHIBI_CATALOG_REGION },
    query: { page, page_size: PAGE_SIZE, has_spine: true }
  });
  if (response.error || !response.data) throw new Error("Chibi catalog page request failed");
  return response.data;
};

const getTotalPages = (pagination: unknown): number => {
  const totalPages = (pagination as { total_pages?: unknown } | undefined)?.total_pages;
  return typeof totalPages === "number" && Number.isSafeInteger(totalPages) && totalPages > 0
    ? Math.min(totalPages, MAX_PAGES)
    : 1;
};

/**
 * Reads every costume row that has a Spine asset name. Several rows can share
 * one name, so the first row of each name that has a character supplies it.
 */
const readCatalogRows = async (
  baseUrl: string,
  fetcher: typeof fetch
): Promise<readonly CatalogRow[]> => {
  const firstPage = await readPage(baseUrl, fetcher, 1);
  const remainingPages = await Promise.all(
    Array.from({ length: getTotalPages(firstPage.pagination) - 1 }, (_, index) =>
      readPage(baseUrl, fetcher, index + 2)
    )
  );

  const rows = new Map<string, CatalogRow>();
  for (const page of [firstPage, ...remainingPages]) {
    for (const item of page.items ?? []) {
      const modelName = item.spineAssetbundleName;
      if (!modelName) continue;
      const character2dId = rows.get(modelName)?.character2dId ?? item.character2dId ?? null;
      rows.set(modelName, { modelName, character2dId });
    }
  }
  return [...rows.values()];
};

/**
 * Lists the JP Chibi models, grouped by game character where master data
 * knows one. Character lookups degrade to an ungrouped list; only a failed
 * model list is reported as an error.
 */
export const resolveChibiCatalog = async (
  fetcher: typeof fetch = fetch,
  resolveCharacters: typeof resolveLive2dCharacterData = resolveLive2dCharacterData
): Promise<ChibiCatalog> => {
  const baseUrl = resolveMasterApiBaseUrl();
  if (!baseUrl) return { status: "unavailable" };

  let rows: readonly CatalogRow[];
  try {
    rows = await readCatalogRows(baseUrl, fetcher);
  } catch {
    return { status: "error" };
  }

  const playableRows = rows.flatMap((row) => {
    const resolved = resolveChibiModelDescriptor(row.modelName);
    return resolved.status === "ok" ? [{ ...row, family: resolved.descriptor.family }] : [];
  });

  const resolution = await resolveCharacters(playableRows, fetcher, CHIBI_CATALOG_REGION).catch(
    () => null
  );

  // Mob and game characters share one ID space, so the type decides the group.
  const isGameCharacter = (characterType: string | null | undefined): boolean =>
    !characterType || characterType === "game_character";

  const characters: ChibiCatalogCharacter[] = [];
  for (const option of resolution?.characters ?? []) {
    if (option.id !== null && isGameCharacter(option.characterType)) {
      characters.push({ id: option.id, name: option.name ?? `#${option.id}` });
    }
  }

  const models: ChibiCatalogModel[] = playableRows.map((row, index) => {
    const resolved = resolution?.models[index];
    return {
      modelName: row.modelName,
      family: row.family,
      characterId: resolved && isGameCharacter(resolved.characterType) ? resolved.characterId : null
    };
  });

  return { status: "ready", models, characters };
};
