import { createPageTitle as joinPageTitle } from "@platform/ui-shell/page-title";

const SITE_TITLE = "Sekai Media Lab";

export const createPageTitle = (...segments: Array<string | null | undefined>): string =>
  joinPageTitle(SITE_TITLE, ...segments);
