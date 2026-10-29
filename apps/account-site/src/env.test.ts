import { testAppEnvironment } from "../../../test/assert-app-environment.js";
import { variables } from "./env.js";

testAppEnvironment(variables, {
  private: ["SEKAI_API_BASE_URL"],
  public: ["PUBLIC_SUPPORT_PAGE_URL"]
});
