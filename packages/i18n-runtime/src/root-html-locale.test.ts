import { describe, expect, it } from "vitest";
import { createRootHtmlLocaleTransform, supportedUiLocales, uiLocaleNameByCode } from "./index";

const transformChunks = (locale: string, chunks: string[]): string => {
  const transform = createRootHtmlLocaleTransform(locale);
  return chunks
    .map((html, index) => transform({ html, done: index === chunks.length - 1 }))
    .join("");
};

describe("uiLocaleNameByCode", () => {
  it("provides a non-empty native name for every shared locale, in registry order", () => {
    expect(Object.keys(uiLocaleNameByCode)).toEqual(supportedUiLocales);
    expect(Object.values(uiLocaleNameByCode).every((name) => name.length > 0)).toBe(true);
    expect(uiLocaleNameByCode["ja-JP"]).toBe("日本語");
    expect(uiLocaleNameByCode.ar).toBe("العربية");
  });
});

describe("createRootHtmlLocaleTransform", () => {
  it.each([
    ["ar", '<html lang="ar" dir="rtl">'],
    ["he-IL", '<html lang="he-IL" dir="rtl">'],
    ["fr", '<html lang="fr" dir="ltr">']
  ])("sets lang and dir for %s on the root tag only", (locale, rootTag) => {
    const html = transformChunks(locale, [
      '<!doctype html><html lang="en" dir="ltr"><body><main lang="en" dir="ltr"></main></body></html>'
    ]);

    expect(html).toBe(
      `<!doctype html>${rootTag}<body><main lang="en" dir="ltr"></main></body></html>`
    );
  });

  it.each([
    ["single-quoted", "<html lang='en' dir='ltr'>"],
    ["unquoted", "<html lang=en dir=ltr>"],
    ["case-insensitive", "<html LANG=en DIR='ltr'>"]
  ])("replaces existing %s attributes", (_caseName, rootTag) => {
    expect(transformChunks("ar", [rootTag])).toBe('<html lang="ar" dir="rtl">');
  });

  it("inserts missing attributes without matching longer attribute names", () => {
    expect(transformChunks("ar", ['<html lang-code="en" dir-extra="ltr">'])).toBe(
      '<html lang-code="en" dir-extra="ltr" lang="ar" dir="rtl">'
    );
  });

  it("buffers a root tag split across chunks", () => {
    const transform = createRootHtmlLocaleTransform("ar");

    expect(transform({ html: "<!doctype html><ht", done: false })).toBe("");
    expect(transform({ html: "ml lang='en'><body></body></html>", done: true })).toBe(
      '<!doctype html><html lang="ar" dir="rtl"><body></body></html>'
    );
  });

  it("returns the buffered HTML unchanged when no root tag arrives", () => {
    const chunks = ["<!doctype html><body>no ", "root tag</body>"];

    expect(transformChunks("ar", chunks)).toBe(chunks.join(""));
  });

  it("passes later chunks through unchanged once the root tag is handled", () => {
    const laterChunk = '<html lang="en" dir="ltr">';

    expect(transformChunks("ar", ['<html lang="en"><body>', laterChunk])).toBe(
      `<html lang="ar" dir="rtl"><body>${laterChunk}`
    );
  });
});
