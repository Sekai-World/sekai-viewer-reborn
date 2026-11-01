import { defineEnvVars } from "@sveltejs/kit/env";
import { envUrl } from "@platform/ui-shell/env-url";

const optionalUrl = envUrl();

// Unset values stay "" so image builds need no runtime configuration; server helpers report
// missing API URLs per request. Set URLs must be well formed so a typo fails at startup instead
// of degrading SSR.
export const variables = defineEnvVars({
  PUBLIC_SUPPORT_PAGE_URL: { public: true, schema: optionalUrl },
  SEKAI_MASTER_API_BASE_URL: { schema: optionalUrl },
  PUBLIC_REMOTE_ASSET_BASE_URL: { public: true, schema: envUrl({ allowPath: true }) },
  SEKAI_API_BASE_URL: { schema: optionalUrl }
});
