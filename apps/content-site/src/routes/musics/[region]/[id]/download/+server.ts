import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, url }) => {
  redirect(
    301,
    `/music/${encodeURIComponent(params.region)}/${encodeURIComponent(params.id)}/download${url.search}`
  );
};
