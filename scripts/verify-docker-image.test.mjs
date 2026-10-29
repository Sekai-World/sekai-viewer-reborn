import assert from "node:assert/strict";
import test from "node:test";
import {
  findSvelteKitImmutableAssetUrl,
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

test("finds Kit 3 relative immutable assets in actual SSR link markup", () => {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <link href="./_app/immutable/entry/start.DvPAjCZb.js" rel="modulepreload">
    <link href="./_app/immutable/assets/regions.DWBwJ0gC.css" rel="stylesheet">
  </head>
</html>`;

  assert.equal(
    findSvelteKitImmutableAssetUrl(html, "http://172.18.0.2:3000")?.href,
    "http://172.18.0.2:3000/_app/immutable/entry/start.DvPAjCZb.js"
  );
});

test("accepts same-origin absolute and single-quoted static asset attributes", () => {
  const html = "<script src='/_app/immutable/chunks/app.CSsH-SR-.js'></script>";

  assert.equal(
    findSvelteKitImmutableAssetUrl(html, "http://127.0.0.1:3000")?.href,
    "http://127.0.0.1:3000/_app/immutable/chunks/app.CSsH-SR-.js"
  );
});

test("rejects external, traversal, non-immutable, and non-resource references", () => {
  const baseUrl = "http://172.18.0.2:3000";
  const invalidHtml = [
    '<link href="https://cdn.example/_app/immutable/entry/start.js" rel="modulepreload">',
    '<script src="./_app/immutable/../entry/start.js"></script>',
    '<link href="/favicon.svg" rel="icon"/>',
    '<script src="./_app/immutable/entry/start.js?cache=1"></script>',
    '<script src="./_app/immutable/entry/start.js#fragment"></script>',
    '<p>href="./_app/immutable/entry/start.js"</p>',
    '<link href="./_app/immutable/assets/logo.svg" rel="preload">'
  ];

  for (const html of invalidHtml) {
    assert.equal(findSvelteKitImmutableAssetUrl(html, baseUrl), null, html);
  }
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
