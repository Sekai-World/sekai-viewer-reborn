import { createAppE2eConfig } from "../../test/playwright-e2e-config";
import { mockServerPort } from "./tests/e2e/mock-server";

// Behavior-only browser tests against the production build. Screenshot
// baselines stay in the root visual config (tests/visual).
export default createAppE2eConfig({ sitePort: 5231, mockServerPort });
