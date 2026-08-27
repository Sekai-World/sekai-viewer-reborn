import { describe, expect, it } from "vitest";
import { normalizeGlobalNotice, parseGlobalNoticesPayload } from "./global-notices";

describe("normalizeGlobalNotice", () => {
  it("normalizes a valid sekai-api notification into a GlobalNotice", () => {
    expect(
      normalizeGlobalNotice({
        id: "maintenance",
        version: 3,
        severity: "warning",
        title: "Planned maintenance",
        message: "The API will be unavailable for a short window.",
        action: {
          label: "Details",
          href: "https://sekai.best/status",
          target: "_blank",
          rel: "noopener"
        },
        dismissible: false,
        startsAt: null,
        expiresAt: null,
        enabled: true
      })
    ).toEqual({
      id: "maintenance",
      version: 3,
      severity: "warning",
      title: "Planned maintenance",
      message: "The API will be unavailable for a short window.",
      action: {
        label: "Details",
        href: "https://sekai.best/status",
        target: "_blank",
        rel: "noopener"
      },
      dismissible: false
    });
  });

  it("accepts a string version and omits optional fields when absent", () => {
    expect(
      normalizeGlobalNotice({
        id: "notice-1",
        version: "2",
        severity: "info",
        title: "Hello",
        message: "World"
      })
    ).toEqual({ id: "notice-1", version: "2", severity: "info", title: "Hello", message: "World" });
  });

  it("returns null when the entry is not a record", () => {
    expect(normalizeGlobalNotice(null)).toBeNull();
    expect(normalizeGlobalNotice("notice")).toBeNull();
    expect(normalizeGlobalNotice([])).toBeNull();
  });

  it("returns null when a required field is missing or invalid", () => {
    expect(normalizeGlobalNotice({ version: 1, severity: "info", title: "T", message: "M" })).toBeNull();
    expect(
      normalizeGlobalNotice({ id: 42, version: 1, severity: "info", title: "T", message: "M" })
    ).toBeNull();
    expect(
      normalizeGlobalNotice({ id: "x", severity: "info", title: "T", message: "M" })
    ).toBeNull();
    expect(
      normalizeGlobalNotice({ id: "x", version: {}, severity: "info", title: "T", message: "M" })
    ).toBeNull();
    expect(
      normalizeGlobalNotice({ id: "x", version: 1, severity: "critical", title: "T", message: "M" })
    ).toBeNull();
    expect(
      normalizeGlobalNotice({ id: "x", version: 1, severity: "info", title: " ", message: "M" })
    ).toBeNull();
    expect(
      normalizeGlobalNotice({ id: "x", version: 1, severity: "info", title: "T", message: "" })
    ).toBeNull();
  });

  it("drops an action without required fields instead of failing the notice", () => {
    expect(
      normalizeGlobalNotice({
        id: "x",
        version: 1,
        severity: "info",
        title: "T",
        message: "M",
        action: { href: "https://example.test" }
      })
    ).toEqual({ id: "x", version: 1, severity: "info", title: "T", message: "M" });
  });

  it("accepts an action with default target semantics", () => {
    expect(
      normalizeGlobalNotice({
        id: "x",
        version: 1,
        severity: "success",
        title: "T",
        message: "M",
        action: { label: "Go", href: "/status" }
      })
    ).toEqual({
      id: "x",
      version: 1,
      severity: "success",
      title: "T",
      message: "M",
      action: { label: "Go", href: "/status" }
    });
  });

  it("ignores an action target that is not in the allow-list", () => {
    expect(
      normalizeGlobalNotice({
        id: "x",
        version: 1,
        severity: "info",
        title: "T",
        message: "M",
        action: { label: "Go", href: "/status", target: "_weird" }
      })
    ).toEqual({
      id: "x",
      version: 1,
      severity: "info",
      title: "T",
      message: "M",
      action: { label: "Go", href: "/status" }
    });
  });
});

describe("parseGlobalNoticesPayload", () => {
  it("unwraps a success envelope and normalizes each entry", () => {
    expect(
      parseGlobalNoticesPayload({
        status: "success",
        message: null,
        data: [
          { id: "a", version: 1, severity: "info", title: "A", message: "a" },
          { id: "broken" },
          { id: "b", version: 2, severity: "error", title: "B", message: "b" }
        ]
      })
    ).toEqual([
      { id: "a", version: 1, severity: "info", title: "A", message: "a" },
      { id: "b", version: 2, severity: "error", title: "B", message: "b" }
    ]);
  });

  it("returns an empty list for invalid envelopes", () => {
    expect(parseGlobalNoticesPayload({ status: "fail", data: [] })).toEqual([]);
    expect(parseGlobalNoticesPayload({ status: "success", data: "nope" })).toEqual([]);
    expect(parseGlobalNoticesPayload({ data: [] })).toEqual([]);
    expect(parseGlobalNoticesPayload("plain string")).toEqual([]);
    expect(parseGlobalNoticesPayload(null)).toEqual([]);
    expect(parseGlobalNoticesPayload([{ id: "x", version: 1 }])).toEqual([]);
  });

  it("returns an empty list when the success envelope has no entries", () => {
    expect(parseGlobalNoticesPayload({ status: "success", data: [] })).toEqual([]);
  });
});
