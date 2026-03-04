import type { LayoutServerLoad } from "./$types";
import {
  DEFAULT_SECONDARY_REGION,
  normalizeRegion,
  normalizeUiLocale,
  PRIMARY_REGION_COOKIE_NAME,
  SECONDARY_REGION_COOKIE_NAME,
  UI_LOCALE_COOKIE_NAME
} from "$lib/region";

export const load: LayoutServerLoad = ({ cookies }) => {
  return {
    primaryRegion: normalizeRegion(cookies.get(PRIMARY_REGION_COOKIE_NAME)),
    secondaryRegion: normalizeRegion(
      cookies.get(SECONDARY_REGION_COOKIE_NAME),
      DEFAULT_SECONDARY_REGION
    ),
    uiLocale: normalizeUiLocale(cookies.get(UI_LOCALE_COOKIE_NAME))
  };
};
