import type { Handle } from "@sveltejs/kit/hooks";
import { createRootHtmlLocaleTransform } from "@platform/i18n-runtime";
import { normalizeUiLocale, UI_LOCALE_COOKIE_NAME } from "#lib/i18n/region.js";

// Renders the root `<html lang dir>` from the UI-locale cookie so SSR output
// matches the selected interface language before hydration. Server errors keep
// SvelteKit's default handling: this file defines no `handleError`.
export const handle: Handle = ({ event, resolve }) =>
  resolve(event, {
    transformPageChunk: createRootHtmlLocaleTransform(
      normalizeUiLocale(event.cookies.get(UI_LOCALE_COOKIE_NAME))
    )
  });
