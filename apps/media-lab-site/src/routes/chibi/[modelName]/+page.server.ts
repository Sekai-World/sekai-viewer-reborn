import { error } from "@sveltejs/kit";
import { resolveChibiModelDescriptor } from "#lib/chibi/chibi-model.js";
import type { PageServerLoad } from "./$types";

/**
 * The descriptor comes from the name alone, so the viewer does not wait for
 * the master API. A well-formed name without assets fails in the browser,
 * where the page reports the model as unavailable.
 */
export const load: PageServerLoad = ({ params }) => {
  const resolved = resolveChibiModelDescriptor(params.modelName);
  if (resolved.status !== "ok") error(404);

  return { descriptor: resolved.descriptor };
};
