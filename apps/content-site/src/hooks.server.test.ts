import type { Handle } from "@sveltejs/kit";
import { describe, expect, it, vi } from "vitest";
import { handle } from "./hooks.server";

type HandleInput = Parameters<Handle>[0];

const renderWithLocaleCookie = async (
  localeCookie: string | undefined,
  html: string
): Promise<string> => {
  const event = {
    cookies: { get: vi.fn().mockReturnValue(localeCookie) }
  } as unknown as HandleInput["event"];

  const resolve: HandleInput["resolve"] = async (_event, options) => {
    const transformPageChunk = options?.transformPageChunk;
    const splitAt = html.indexOf("<html") + 7;
    const chunks = [html.slice(0, splitAt), html.slice(splitAt)];
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
});
