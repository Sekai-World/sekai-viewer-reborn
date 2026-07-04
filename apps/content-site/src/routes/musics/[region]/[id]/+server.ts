import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, url }) => {
  redirect(301, `/music/${params.region}/${params.id}${url.search}`);
};
