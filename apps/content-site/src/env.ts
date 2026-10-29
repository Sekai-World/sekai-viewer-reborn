import { defineEnvVars } from "@sveltejs/kit/env";

// Empty defaults keep build-time configuration optional; server helpers validate required URLs when used.
export const variables = defineEnvVars({
  SEKAI_MASTER_API_BASE_URL: { schema: (input) => input ?? "" },
  SEKAI_API_BASE_URL: { schema: (input) => input ?? "" },
  SEKAI_REMOTE_ASSET_BASE_URL: { schema: (input) => input ?? "" },
  PUBLIC_SUPPORT_PAGE_URL: { public: true, schema: (input) => input ?? "" },
  PUBLIC_PATREON_URL: { public: true, schema: (input) => input ?? "" },
  PUBLIC_KOFI_URL: { public: true, schema: (input) => input ?? "" },
  PUBLIC_TOOLS_SITE_BASE_URL: { public: true, schema: (input) => input ?? "" },
  PUBLIC_SEKAI_I18N_BASE_URL: { public: true, schema: (input) => input ?? "" },
  PUBLIC_REMOTE_ASSET_BASE_URL: { public: true, schema: (input) => input ?? "" }
});
