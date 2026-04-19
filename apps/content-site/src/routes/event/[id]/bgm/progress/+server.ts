import { redirect, type RequestHandler } from "@sveltejs/kit";
import { normalizeRegion } from "$lib/region";

const redirectToNewPath = ({
  eventId,
  region,
  url
}: {
  eventId: string;
  region: string;
  url: URL;
}): never => {
  const searchParams = new URLSearchParams(url.searchParams);
  searchParams.delete("region");
  const query = searchParams.toString();
  const location = `/event/${encodeURIComponent(region)}/${encodeURIComponent(eventId)}/bgm/progress${
    query ? `?${query}` : ""
  }`;

  throw redirect(308, location);
};

export const GET: RequestHandler = ({ params, url }) => {
  return redirectToNewPath({
    eventId: params.id?.trim() ?? "",
    region: normalizeRegion(url.searchParams.get("region")),
    url
  });
};

export const POST: RequestHandler = ({ params, url }) => {
  return redirectToNewPath({
    eventId: params.id?.trim() ?? "",
    region: normalizeRegion(url.searchParams.get("region")),
    url
  });
};
