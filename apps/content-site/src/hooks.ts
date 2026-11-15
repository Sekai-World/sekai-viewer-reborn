import type { Reroute } from "@sveltejs/kit/hooks";
import { rerouteUnknownRegion } from "#lib/region-routes.js";

export const reroute: Reroute = ({ url }) => rerouteUnknownRegion(url.pathname);
