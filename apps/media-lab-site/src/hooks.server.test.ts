import type { Handle } from "@sveltejs/kit/hooks";
import { describe, expect, it, vi } from "vitest";
import { handle } from "./hooks.server";

type HandleInput = Parameters<Handle>[0];

const renderWithLocaleCookie = async (localeCookie: string | undefined): Promise<string> => {
  const event = {
    cookies: { get: vi.fn().mockReturnValue(localeCookie) },
    request: new Request("https://media-lab.example/"),
    url: new URL("https://media-lab.example/")
  } as unknown as HandleInput["event"];
  const resolve: HandleInput["resolve"] = async (_event, options) =>
    new Response(
      await options?.transformPageChunk?.({
        html: '<!doctype html><html lang="en"><body></body></html>',
        done: true
      })
    );

  const response = await handle({ event, resolve });
  expect(event.cookies.get).toHaveBeenCalledWith("media_lab_site_ui_locale");
  return response.text();
};

describe("media-lab-site SSR document locale", () => {
  it.each([
    ["ar", "ar", '<html lang="ar" dir="rtl">'],
    ["a normalized cookie", "fr_FR", '<html lang="fr" dir="ltr">'],
    ["an unsupported cookie", "xx", '<html lang="en" dir="ltr">'],
    ["no cookie", undefined, '<html lang="en" dir="ltr">']
  ])("renders the root html tag for %s", async (_caseName, cookie, rootTag) => {
    await expect(renderWithLocaleCookie(cookie)).resolves.toBe(
      `<!doctype html>${rootTag}<body></body></html>`
    );
  });
});
