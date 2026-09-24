import type { IconifyIcon } from "@iconify/svelte";

// Icon data kept in the shared package so these primitives do not depend on an
// app's Iconify registry (each app registers its own mdi icons at startup).
// Bodies are copied from @iconify-icons/mdi.
export const openInNewIcon: IconifyIcon = {
  body: '<path fill="currentColor" d="M14 3v2h3.59l-9.83 9.83l1.41 1.41L19 6.41V10h2V3m-2 16H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2z"/>',
  height: 24,
  width: 24
};

export const downloadIcon: IconifyIcon = {
  body: '<path fill="currentColor" d="M5 20h14v-2H5m14-9h-4V3H9v6H5l7 7z"/>',
  height: 24,
  width: 24
};

export const closeIcon: IconifyIcon = {
  body: '<path fill="currentColor" d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12z"/>',
  height: 24,
  width: 24
};
