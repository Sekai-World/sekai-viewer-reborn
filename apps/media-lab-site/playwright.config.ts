import { createAppE2eConfig } from "../../test/playwright-e2e-config";
import { mockServerPort } from "./tests/e2e/mock-server";

export default createAppE2eConfig({ sitePort: 4106, mockServerPort });
