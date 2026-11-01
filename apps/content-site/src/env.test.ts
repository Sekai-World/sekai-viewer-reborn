import { vi } from "vitest";
import { testAppEnvironment } from "../../../test/assert-app-environment.js";
import { variables } from "./env.js";

const appEnvironment = vi.hoisted(() => ({ building: false }));
vi.mock("$app/env", () => ({
  get building() {
    return appEnvironment.building;
  }
}));

testAppEnvironment(
  variables,
  {
    private: ["SEKAI_API_BASE_URL", "SEKAI_MASTER_API_BASE_URL", "SEKAI_REMOTE_ASSET_BASE_URL"],
    public: [
      "PUBLIC_KOFI_URL",
      "PUBLIC_PATREON_URL",
      "PUBLIC_REMOTE_ASSET_BASE_URL",
      "PUBLIC_SEKAI_I18N_BASE_URL",
      "PUBLIC_SUPPORT_PAGE_URL",
      "PUBLIC_TOOLS_SITE_BASE_URL"
    ],
    paths: ["PUBLIC_REMOTE_ASSET_BASE_URL"],
    unvalidated: ["PUBLIC_KOFI_URL", "PUBLIC_PATREON_URL"],
    requiredAtRuntime: ["PUBLIC_REMOTE_ASSET_BASE_URL"]
  },
  (building) => {
    appEnvironment.building = building;
  }
);
