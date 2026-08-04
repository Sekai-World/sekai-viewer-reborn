const EVENT_CARD_BASE_SHADOW_CLASS =
  "shadow-[0_5px_14px_rgba(0,0,0,0.06),0_1px_4px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_18px_rgba(0,0,0,0.26),0_2px_8px_rgba(0,0,0,0.18)]";

export const CURRENT_EVENT_CARD_FRAME_CLASS = "card-hover-lift relative isolate block w-full";

export const EVENT_LIST_CARD_FRAME_CLASS = "card-hover-lift relative isolate block w-full";

export const EVENT_CARD_SURFACE_CLASS = `card content-card-shell relative overflow-hidden ${EVENT_CARD_BASE_SHADOW_CLASS}`;

export const EVENT_CARD_BODY_CLASS = "card-body relative z-10 p-3 md:p-4";

export const EVENT_CARD_MEDIA_CLASS = `relative mb-2 flex aspect-5/2 items-center justify-center overflow-hidden px-[4%] py-[4%] md:mb-3`;

export const EVENT_CARD_IMAGE_CLASS = `mx-auto h-full max-h-full w-full max-w-full object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.08)] md:w-3/4 md:min-w-[min(200px,100%)]`;

export const EVENT_CARD_META_BADGE_CLASS =
  "badge badge-sm border-base-content/25 bg-transparent font-semibold text-base-content";

export const EVENT_LIST_CARD_MEDIA_CLASS = `relative flex h-40 items-center justify-center overflow-hidden bg-transparent p-1.5 sm:p-2`;

export const EVENT_LIST_CARD_IMAGE_CLASS = `h-full w-full object-contain`;

export const EVENT_LIST_CARD_TITLE_CLASS = `line-clamp-2 text-base font-semibold leading-tight`;
