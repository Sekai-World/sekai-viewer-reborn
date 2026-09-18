const SITE_TITLE = "Sekai Viewer";

export const createPageTitle = (
  pageTitle: string,
  ...context: Array<string | null | undefined>
): string => {
  const segments = [pageTitle, ...context]
    .map((segment) => segment?.trim())
    .filter((segment): segment is string => Boolean(segment));

  return segments.length > 0 ? `${segments.join(" ")} - ${SITE_TITLE}` : SITE_TITLE;
};
