import { defineEnvVars } from "@sveltejs/kit/env";
import { envUrl } from "@platform/ui-shell/env-url";

const optionalUrl = envUrl();

// Unset values stay "" so notices remain optional; set URLs must be well formed so a typo fails
// at startup instead of silently hiding notices or breaking the support link.
export const variables = defineEnvVars({
  PUBLIC_SUPPORT_PAGE_URL: { public: true, schema: optionalUrl },
  SEKAI_API_BASE_URL: { schema: optionalUrl }
});
