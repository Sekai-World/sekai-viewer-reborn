import {
  getUnitProfilesByRegionByUnit,
  getUnitProfilesByRegionByUnitMembers
} from "@platform/sekai-master-api-sdk";
import { normalizeRegion } from "$lib/i18n/region";
import { resolveCanonicalUnitSlug } from "$lib/domain/unit-icon";
import { getMasterApiBaseUrl } from "$lib/server/config";
import { parseUnitDetail, parseUnitMembers } from "$lib/server/unit-detail";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const region = normalizeRegion(params.region);
  const unit = resolveCanonicalUnitSlug(params.unit);
  const baseUrl = getMasterApiBaseUrl();

  const payload = unit
    ? Promise.all([
        getUnitProfilesByRegionByUnit({ baseUrl, path: { region, unit } }),
        getUnitProfilesByRegionByUnitMembers({ baseUrl, path: { region, unit } })
      ])
        .then(([profileResponse, membersResponse]) => {
          if (profileResponse.error) return { unit: null, members: [], loadFailed: false as const };
          const detail = parseUnitDetail(profileResponse.data);
          return {
            unit: detail,
            members: membersResponse.error ? [] : parseUnitMembers(membersResponse.data),
            loadFailed: false as const
          };
        })
        .catch(() => ({ unit: null, members: [], loadFailed: true as const }))
    : Promise.resolve({ unit: null, members: [], loadFailed: false as const });

  payload.catch(() => {});
  return { region, unit, payload };
};
