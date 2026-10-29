import type { Handle } from "@sveltejs/kit/hooks";
import { getUiLocaleDirection } from "#lib/i18n/config.js";
import { DEFAULT_UI_LOCALE, normalizeUiLocale, UI_LOCALE_COOKIE_NAME } from "#lib/i18n/region.js";

const ROOT_HTML_OPEN_TAG = /<html\b(?:[^>"']|"[^"]*"|'[^']*')*>/i;

const setRootHtmlAttribute = (tag: string, name: "lang" | "dir", value: string): string => {
  const attributePattern = new RegExp(
    String.raw`\s+${name}(?=\s|=|/?>)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?`,
    "i"
  );
  const replacement = ` ${name}="${value}"`;

  return attributePattern.test(tag)
    ? tag.replace(attributePattern, replacement)
    : tag.replace(/>$/, `${replacement}>`);
};

const transformRootHtmlTag = (tag: string, locale: string): string => {
  const direction = getUiLocaleDirection(locale);
  return setRootHtmlAttribute(setRootHtmlAttribute(tag, "lang", locale), "dir", direction);
};

export const handle: Handle = async ({ event, resolve }) => {
  const locale = normalizeUiLocale(event.cookies.get(UI_LOCALE_COOKIE_NAME), DEFAULT_UI_LOCALE);
  let bufferedHtml = "";
  let rootTagHandled = false;

  return resolve(event, {
    transformPageChunk: ({ html, done }) => {
      if (rootTagHandled) return html;

      const combinedHtml = bufferedHtml + html;
      const rootTagMatch = ROOT_HTML_OPEN_TAG.exec(combinedHtml);
      if (!rootTagMatch) {
        if (done) {
          rootTagHandled = true;
          bufferedHtml = "";
          return combinedHtml;
        }

        bufferedHtml = combinedHtml;
        return "";
      }

      rootTagHandled = true;
      bufferedHtml = "";
      const rootTag = rootTagMatch[0];
      const start = rootTagMatch.index;
      return `${combinedHtml.slice(0, start)}${transformRootHtmlTag(rootTag, locale)}${combinedHtml.slice(start + rootTag.length)}`;
    }
  });
};
