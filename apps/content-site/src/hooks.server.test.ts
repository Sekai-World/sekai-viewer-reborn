import type { Handle } from "@sveltejs/kit/hooks";
import { describe, expect, it, vi } from "vitest";
import { handle } from "./hooks.server";

type HandleInput = Parameters<Handle>[0];

const renderWithChunks = async (
  localeCookie: string | undefined,
  chunks: string[]
): Promise<string> => {
  const event = {
    cookies: { get: vi.fn().mockReturnValue(localeCookie) }
  } as unknown as HandleInput["event"];

  const resolve: HandleInput["resolve"] = async (_event, options) => {
    const transformPageChunk = options?.transformPageChunk;
    const transformedHtml = chunks
      .map(
        (chunk, index) =>
          transformPageChunk?.({ html: chunk, done: index === chunks.length - 1 }) ?? chunk
      )
      .join("");

    return new Response(transformedHtml);
  };

  const response = await handle({ event, resolve });
  return response.text();
};

const renderWithLocaleCookie = (localeCookie: string | undefined, html: string): Promise<string> =>
  renderWithChunks(localeCookie, [html]);
const htmlDocument =
  '<!doctype html><html lang="zh-CN" dir="ltr"><head></head><body><main lang="zh-CN" dir="ltr">content</main></body></html>';

describe("content-site SSR document locale", () => {
  it.each([
    ["ar", '<html lang="ar" dir="rtl">'],
    ["he-IL", '<html lang="he-IL" dir="rtl">']
  ])("renders the root document with locale %s", async (cookie, rootTag) => {
    const html = await renderWithLocaleCookie(cookie, htmlDocument);

    expect(html).toContain(rootTag);
  });

  it("uses the default locale when the cookie is absent", async () => {
    const html = await renderWithLocaleCookie(undefined, htmlDocument);

    expect(html).toBe(htmlDocument);
  });

  it.each([
    ["JA_jp", '<html lang="ja-JP" dir="ltr">'],
    ["zh", '<html lang="zh-CN" dir="ltr">'],
    ["not_a_locale", '<html lang="zh-CN" dir="ltr">']
  ])("normalizes cookie value %s for SSR", async (cookie, rootTag) => {
    const html = await renderWithLocaleCookie(cookie, htmlDocument);

    expect(html).toContain(rootTag);
  });

  it("changes only the root html attributes and leaves body attributes untouched", async () => {
    const html = await renderWithLocaleCookie("ar", htmlDocument);

    expect(html).toBe(
      '<!doctype html><html lang="ar" dir="rtl"><head></head><body><main lang="zh-CN" dir="ltr">content</main></body></html>'
    );
  });

  it.each([
    ["single-quoted", "<html lang='en' dir='ltr'>"],
    ["unquoted", "<html lang=en dir=ltr>"],
    ["case-insensitive", "<html LANG=en DIR='ltr'>"]
  ])("updates existing %s root attributes", async (_caseName, rootTag) => {
    const html = await renderWithLocaleCookie("ar", rootTag);

    expect(html).toBe('<html lang="ar" dir="rtl">');
  });

  it("inserts missing root attributes without matching longer attribute names", async () => {
    const html = await renderWithLocaleCookie("ar", '<html lang-code="en" dir-extra="ltr">');

    expect(html).toBe('<html lang-code="en" dir-extra="ltr" lang="ar" dir="rtl">');
  });

  it("buffers an html root tag split across chunks", async () => {
    const html = await renderWithChunks("ar", [
      "<!doctype html><ht",
      "ml lang='en' dir=ltr><body>content</body></html>"
    ]);

    expect(html).toBe('<!doctype html><html lang="ar" dir="rtl"><body>content</body></html>');
  });

  it("returns the original buffered HTML when no root tag arrives by the final chunk", async () => {
    const chunks = ["<!doctype html><body>no ", "root tag</body>"];
    const html = await renderWithChunks(undefined, chunks);

    expect(html).toBe(chunks.join(""));
  });

  it("leaves all later chunks unchanged after handling the root tag", async () => {
    const laterChunk = '<main lang="zh-CN" dir="ltr">content</main><html lang="en" dir="ltr">';
    const html = await renderWithChunks("ar", ['<html lang="en" dir="ltr"><body>', laterChunk]);

    expect(html).toBe(`<html lang="ar" dir="rtl"><body>${laterChunk}`);
  });
});
