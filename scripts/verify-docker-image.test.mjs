import assert from "node:assert/strict";
import test from "node:test";
import {
  getSmokeContainerUrl,
  smokePort,
  supportedApps,
  validateSmokeArguments
} from "./verify-docker-image.mjs";

test("accepts only fixed app names and numeric local CI image tags", () => {
  for (const app of supportedApps) {
    const image = `sekai-viewer-${app}:ci-40880256037-1`;
    assert.deepEqual(validateSmokeArguments(app, image), { app, image });
  }

  assert.throws(
    () => validateSmokeArguments("../../app", "sekai-viewer-../../app:ci-1-1"),
    /Expected an app from/
  );
  assert.throws(
    () => validateSmokeArguments("content-site", "sekai-viewer-content-site:ci-1-1/other"),
    /numeric run ID and attempt/
  );
  assert.throws(
    () => validateSmokeArguments("content-site", "sekai-viewer-content-site:ci-1-1-extra"),
    /numeric run ID and attempt/
  );
  assert.throws(
    () => validateSmokeArguments("account-site", undefined),
    /numeric run ID and attempt/
  );
});

test("targets a live app on its private smoke-network address and runtime port", () => {
  const inspection = {
    State: { Running: true, Status: "running", ExitCode: 0 },
    NetworkSettings: {
      Networks: { "sekai-viewer-smoke-test": { IPAddress: "172.19.0.2" } }
    }
  };

  assert.equal(smokePort, 3000);
  assert.equal(
    getSmokeContainerUrl(inspection, "content-site", "sekai-viewer-smoke-test"),
    "http://172.19.0.2:3000"
  );
});

test("reports an exited container before HTTP probing", () => {
  const inspection = {
    State: { Running: false, Status: "exited", ExitCode: 1, Error: "startup failed" },
    NetworkSettings: { Networks: {} }
  };

  assert.throws(
    () => getSmokeContainerUrl(inspection, "content-site", "sekai-viewer-smoke-test"),
    /content-site container is not running \(status=exited, exitCode=1, error=startup failed\)/
  );
});

test("rejects missing or non-private smoke-network addresses", () => {
  const runningContainer = (address) => ({
    State: { Running: true },
    NetworkSettings: {
      Networks: { "sekai-viewer-smoke-test": { IPAddress: address } }
    }
  });

  assert.throws(
    () =>
      getSmokeContainerUrl(runningContainer("8.8.8.8"), "tools-site", "sekai-viewer-smoke-test"),
    /no private IPv4 address/
  );
  assert.throws(
    () => getSmokeContainerUrl(runningContainer(""), "tools-site", "missing-network"),
    /no private IPv4 address/
  );
});
