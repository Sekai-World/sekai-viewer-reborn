/**
 * Joins page-title segments into the workspace-wide convention
 * `<content title> | <catalog title> | <site name>`; empty and blank
 * segments (e.g. a not-yet-loaded content title) drop out, and a fully
 * empty segment list degrades to the bare site name for home pages.
 */
export const createPageTitle = (
  siteName: string,
  ...segments: Array<string | null | undefined>
): string => {
  const parts = [...segments, siteName]
    .map((segment) => segment?.trim())
    .filter((segment): segment is string => Boolean(segment));

  return parts.join(" | ");
};
