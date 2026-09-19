import { redirect } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

// Story types are sidebar sub-pages now; forward the bare landing to the
// default one, preserving the region query.
export const load: PageLoad = ({ url }) => {
  redirect(307, `/story-reader/unit${url.search}`);
};
