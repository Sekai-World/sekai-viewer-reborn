export const CARD_LIST_VIEW_MODES = ["grid", "agenda", "comfy"] as const;
export type CardListViewMode = (typeof CARD_LIST_VIEW_MODES)[number];

export const DEFAULT_CARD_LIST_VIEW_MODE: CardListViewMode = "grid";

export const parseCardListViewMode = (value: string | null | undefined): CardListViewMode => {
  switch (value) {
    case "agenda":
    case "comfy":
    case "grid":
      return value;
    default:
      return DEFAULT_CARD_LIST_VIEW_MODE;
  }
};

export const getCardListViewFromSearchParams = (
  searchParams: URLSearchParams
): CardListViewMode | null => {
  const value = searchParams.get("view");
  return value === null ? null : parseCardListViewMode(value);
};

export const withCardListView = (
  href: string,
  viewMode: CardListViewMode | null | undefined
): string => {
  if (viewMode === null || viewMode === undefined) {
    return href;
  }

  const url = new URL(href, "https://content-site.invalid");
  url.searchParams.set("view", viewMode);
  return `${url.pathname}${url.search}${url.hash}`;
};
