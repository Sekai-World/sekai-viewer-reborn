import { testAppEnvironment } from "../../../test/assert-app-environment.js";
import { variables } from "./env.js";

testAppEnvironment(variables, {
  private: ["SEKAI_API_BASE_URL", "SEKAI_MASTER_API_BASE_URL"],
  public: ["PUBLIC_REMOTE_ASSET_BASE_URL", "PUBLIC_SEKAI_I18N_BASE_URL", "PUBLIC_SUPPORT_PAGE_URL"],
  paths: ["PUBLIC_REMOTE_ASSET_BASE_URL"]
});
