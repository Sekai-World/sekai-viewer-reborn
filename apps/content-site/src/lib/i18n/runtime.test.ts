import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getLocalI18nMessages,
  resolveI18nMessageBundle,
  type I18nNamespace
} from "./runtime";

const namespaces: readonly I18nNamespace[] = ["common", "event"];

describe("resolveI18nMessageBundle", () => {
  it("returns the target locale bundle when remote loading succeeds", async () => {
    const targetMessages = { home: "ホーム", eventDetailTitle: "イベント詳細" };

    await expect(resolveI18nMessageBundle(async () => targetMessages, namespaces)).resolves.toBe(
      targetMessages
    );
  });

  it("uses local source messages when remote loading fails", async () => {
    await expect(
      resolveI18nMessageBundle(async () => Promise.reject(new Error("dictionary unavailable")), namespaces)
    ).resolves.toEqual(getLocalI18nMessages(namespaces));
  });

  it("uses local source messages when the server bundle misses its deadline", async () => {
    vi.useFakeTimers();
    const pendingBundle = new Promise<Record<string, string>>(() => {});

    const result = resolveI18nMessageBundle(() => pendingBundle, namespaces, 25);
    await vi.advanceTimersByTimeAsync(25);

    await expect(result).resolves.toEqual(getLocalI18nMessages(namespaces));
  });
});

afterEach(() => {
  vi.useRealTimers();
});
