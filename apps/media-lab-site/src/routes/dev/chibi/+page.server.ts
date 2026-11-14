import { dev } from "$app/env";
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

/** Developer preview for the Chibi player; it does not exist in production builds. */
export const load: PageServerLoad = () => {
  if (!dev) error(404);
  return {};
};
