import { building } from "$app/env";
import { defineEnvVars } from "@sveltejs/kit/env";
import { envUrl } from "@platform/ui-shell/env-url";

const optionalUrl = envUrl();

// Unset values stay "" so image builds need no runtime configuration; server helpers report
// missing API URLs per request. Set URLs must be well formed so a typo fails at startup instead
// of degrading SSR. Client asset URLs throw without a base, so that one is required at startup.
export const variables = defineEnvVars({
  SEKAI_MASTER_API_BASE_URL: { schema: optionalUrl },
  SEKAI_API_BASE_URL: { schema: optionalUrl },
  SEKAI_REMOTE_ASSET_BASE_URL: { schema: optionalUrl },
  PUBLIC_SUPPORT_PAGE_URL: { public: true, schema: optionalUrl },
  // the /support page shows only HTTPS Patreon or Ko-fi URLs and hides anything else
  PUBLIC_PATREON_URL: { public: true, schema: (input) => input ?? "" },
  PUBLIC_KOFI_URL: { public: true, schema: (input) => input ?? "" },
  PUBLIC_TOOLS_SITE_BASE_URL: { public: true, schema: optionalUrl },
  PUBLIC_SEKAI_I18N_BASE_URL: { public: true, schema: optionalUrl },
  PUBLIC_REMOTE_ASSET_BASE_URL: {
    public: true,
    schema: (input) => envUrl({ allowPath: true, required: !building })(input)
  }
});
