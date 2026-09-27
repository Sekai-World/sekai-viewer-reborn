import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pagePath = resolve(process.cwd(), "src/routes/music-recommender/+page.svelte");
const layoutPath = resolve(process.cwd(), "src/routes/+layout.svelte");
const layoutServerPath = resolve(process.cwd(), "src/routes/+layout.server.ts");
const messagesPath = resolve(
  process.cwd(),
  "../../packages/i18n-source/tools-site/music-recommender.json"
);
const runtimePath = resolve(process.cwd(), "src/lib/i18n/runtime.ts");

describe("music recommender UI contract", () => {
  it("consumes the generated page data contract and keeps calculations server-side", async () => {
    const source = await readFile(pagePath, "utf8");
    expect(source).toContain('type PageData = PageProps["data"]');
    expect(source).toContain('type MusicRecommendation = PageData["items"][number]');
    expect(source).toContain("let { data }: PageProps = $props()");
    expect(source).toContain("reloadWithQuery({ source: next })");
    expect(source).toContain("sourceHash");
    expect(source).toContain("lastModifiedAt");
    expect(source).toContain("formulaVersion");
    expect(source).toContain("durationNotRanked");
    expect(source).not.toContain("RecommenderPageData");
    expect(source).not.toContain("as unknown");
    expect(source).not.toContain("sourceRevision");
    expect(source).not.toContain("calculateJpSoloYield");
    expect(source).not.toContain("rankMusicRecommendations");
  });

  it("exposes the required states, inputs, and JP Solo-only mode", async () => {
    const source = await readFile(pagePath, "utf8");
    expect(source).toContain("let noSkill = $state");
    expect(source).toContain("Array.from({ length: 6 }");
    expect(source).toContain('"musicRecommender.incomplete"');
    expect(source).toContain('data.status === "unavailable"');
    expect(source).toContain("getUnavailableMessageKey(data.reasonCode)");
    expect(source).toContain("FIELD_DETAIL_REASON_CODES.has(data.reasonCode)");
    expect(source).not.toMatch(/data\.reason(?!Code)/);
    expect(source).toContain("data.missingFields.join");
    expect(source).toContain("data.invalidFields.join");
    expect(source).toContain('id: "jp-solo"');
    expect(source).toContain("enabled: false");
  });

  it("registers the dedicated namespace and navigation entry", async () => {
    const [layout, layoutServer, runtime, messages] = await Promise.all([
      readFile(layoutPath, "utf8"),
      readFile(layoutServerPath, "utf8"),
      readFile(runtimePath, "utf8"),
      readFile(messagesPath, "utf8")
    ]);
    expect(layout).toContain('href: "/music-recommender"');
    expect(layout).toContain('page.url.pathname === "/music-recommender"');
    expect(layoutServer).toContain('"music-recommender"] as const');
    expect(runtime).toContain("musicRecommenderSourceMessages");
    expect(JSON.parse(messages)).toMatchObject({
      "musicRecommender.title": "JP Solo music recommender"
    });
  });

  it("keeps an invalid source unknown and does not render a fallback source link", async () => {
    const source = await readFile(pagePath, "utf8");

    expect(source).toContain("data.source === null");
    expect(source).toContain('translate("musicRecommender.sourceUnavailable")');
    expect(source).toContain("{#if data.source}");
    expect(source).toContain("href={data.source.url}");
    expect(source).not.toContain("SOURCE_URLS[source]");
  });

  it("shows last-modified provenance instead of a revision", async () => {
    const [source, messagesText] = await Promise.all([
      readFile(pagePath, "utf8"),
      readFile(messagesPath, "utf8")
    ]);
    const messages = JSON.parse(messagesText) as Record<string, string>;

    expect(source).toContain('translate("musicRecommender.lastModified")');
    expect(source).toContain("data.provenance?.freshness.lastModifiedAt");
    expect(messages["musicRecommender.lastModified"]).toBe("Source last modified");
    expect(messages["musicRecommender.sourceRevision"]).toBeUndefined();
  });
});
