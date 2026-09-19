import { createPageTitle as joinPageTitle } from "@platform/ui-shell/page-title";

const SITE_TITLE = "Sekai Viewer";

export const createPageTitle = (
  pageTitle: string | null | undefined,
  ...context: Array<string | null | undefined>
): string => joinPageTitle(SITE_TITLE, pageTitle, ...context);
