import { describe, expect, it } from "vitest";
import {
  EVENT_CARD_BANNER_BODY_CLASS,
  EVENT_CARD_BODY_CLASS,
  EVENT_CARD_EMPTY_BODY_CLASS
} from "./event-card";

describe("event card style variants", () => {
  it("keeps archive body variants based on the shared card body class", () => {
    expect(EVENT_CARD_BANNER_BODY_CLASS).toBe(
      `${EVENT_CARD_BODY_CLASS} archive-event-banner-body`
    );
    expect(EVENT_CARD_EMPTY_BODY_CLASS).toBe(
      `${EVENT_CARD_BODY_CLASS} archive-event-banner-empty-body`
    );
  });
});
