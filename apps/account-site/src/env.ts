import { defineEnvVars } from "@sveltejs/kit/env";

// Empty defaults let notices remain optional when the API URL is not configured.
export const variables = defineEnvVars({
  PUBLIC_SUPPORT_PAGE_URL: { public: true, schema: (input) => input ?? "" },
  SEKAI_API_BASE_URL: { schema: (input) => input ?? "" }
});
