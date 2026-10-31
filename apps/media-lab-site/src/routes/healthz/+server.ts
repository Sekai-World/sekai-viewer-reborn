import type { RequestHandler } from "./$types";

// Liveness/readiness endpoint for the container probes. It must stay free of
// upstream calls: a sekai-api or sekai-master-api outage should degrade pages,
// not take every pod out of rotation.
export const GET: RequestHandler = () =>
  new Response("ok", {
    headers: { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" }
  });
