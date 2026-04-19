export const EVENT_CARD_HOVER_TIMING_CLASS = "duration-[220ms] ease-out";

const EVENT_CARD_BASE_SHADOW_CLASS =
  "shadow-[0_10px_24px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_14px_32px_rgba(0,0,0,0.36),0_4px_14px_rgba(0,0,0,0.22)]";
const EVENT_CARD_BASE_HOVER_SHADOW_CLASS =
  "hover:shadow-[0_24px_44px_rgba(0,0,0,0.14),0_10px_24px_rgba(107,114,128,0.12)] dark:hover:shadow-[0_28px_58px_rgba(0,0,0,0.52),0_10px_24px_rgba(107,114,128,0.22)]";

export const CURRENT_EVENT_CARD_FRAME_CLASS =
  `card content-card-shell group relative w-full overflow-hidden transform-gpu transition-[transform,box-shadow] ${EVENT_CARD_HOVER_TIMING_CLASS} ${EVENT_CARD_BASE_SHADOW_CLASS} ${EVENT_CARD_BASE_HOVER_SHADOW_CLASS} hover:-translate-y-0.75 hover:scale-[1.014]`;

export const EVENT_LIST_CARD_FRAME_CLASS =
  `card content-card-shell group relative w-full overflow-hidden transform-gpu transition-[transform,box-shadow] ${EVENT_CARD_HOVER_TIMING_CLASS} ${EVENT_CARD_BASE_SHADOW_CLASS} ${EVENT_CARD_BASE_HOVER_SHADOW_CLASS} hover:-translate-y-[0.32rem]`;

export const EVENT_CARD_GLOW_CLASS =
  `pointer-events-none absolute inset-x-6 top-0 h-24 rounded-full bg-linear-to-b from-primary/18 via-primary/8 to-transparent opacity-0 blur-2xl transition-opacity ${EVENT_CARD_HOVER_TIMING_CLASS} group-hover:opacity-100`;

export const EVENT_CARD_BODY_CLASS = "card-body relative z-10";

export const EVENT_CARD_MEDIA_CLASS =
  `mb-2 flex items-center justify-center md:mb-3`;

export const EVENT_CARD_IMAGE_CLASS =
  `mx-auto h-auto w-full max-w-full object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.08)] transition-transform ${EVENT_CARD_HOVER_TIMING_CLASS} group-hover:scale-[1.05] md:w-3/4 md:min-w-[min(200px,100%)]`;

export const EVENT_LIST_CARD_MEDIA_CLASS =
  `relative flex h-40 items-center justify-center overflow-hidden bg-linear-to-br from-base-200/78 via-base-100 to-base-200/52 p-4 transition-transform ${EVENT_CARD_HOVER_TIMING_CLASS} group-hover:-translate-y-[0.22rem] sm:h-44 sm:p-5`;

export const EVENT_LIST_CARD_IMAGE_CLASS =
  `h-full w-full object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.08)] transition-[transform,filter] ${EVENT_CARD_HOVER_TIMING_CLASS} group-hover:-translate-y-[0.08rem] group-hover:brightness-[1.02]`;

export const EVENT_LIST_CARD_TITLE_CLASS =
  `line-clamp-2 text-base font-semibold leading-tight transition-transform ${EVENT_CARD_HOVER_TIMING_CLASS} group-hover:-translate-y-[0.2rem]`;
