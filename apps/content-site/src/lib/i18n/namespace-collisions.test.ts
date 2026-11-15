import cardMessages from "@platform/i18n-source/content-site/card.json";
import characterMessages from "@platform/i18n-source/content-site/character.json";
import eventMessages from "@platform/i18n-source/content-site/event.json";
import homeMessages from "@platform/i18n-source/content-site/home.json";
import musicMessages from "@platform/i18n-source/content-site/music.json";
import virtualLiveMessages from "@platform/i18n-source/content-site/virtual-live.json";
import { describe, expect, it } from "vitest";

type Messages = Record<string, string>;

/**
 * Feature namespaces that `getRouteI18nNamespaces` in
 * `src/routes/+layout.server.ts` loads into one flat bundle. A later namespace
 * silently overwrites an earlier one, so a shared key must carry the same text.
 */
const coLoadedNamespaces: [string, Messages, string, Messages][] = [
  ["card", cardMessages, "event", eventMessages],
  ["virtual-live", virtualLiveMessages, "music", musicMessages],
  ["character", characterMessages, "card", cardMessages],
  ["home", homeMessages, "event", eventMessages]
];

describe("co-loaded i18n namespaces", () => {
  it.each(coLoadedNamespaces)(
    "%s and %s do not define conflicting keys",
    (_firstName, first, _secondName, second) => {
      const conflicts = Object.keys(first).filter(
        (key) => key in second && first[key] !== second[key]
      );

      expect(conflicts).toEqual([]);
    }
  );
});
