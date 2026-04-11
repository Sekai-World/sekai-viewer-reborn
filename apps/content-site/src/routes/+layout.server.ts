import type { LayoutServerLoad } from "./$types";
import { normalizeUiLocale, UI_LOCALE_COOKIE_NAME } from "$lib/region";

export const load: LayoutServerLoad = ({ cookies }) => {
  return {
    uiLocale: normalizeUiLocale(cookies.get(UI_LOCALE_COOKIE_NAME))
  };
};
