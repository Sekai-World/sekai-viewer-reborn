import { describe, expect, it } from "vitest";
import {
  isSafeHref,
  normalizeGlobalNotice,
  parseGlobalNoticesPayload,
  stripTrailingSlashes
} from "./global-notices";

describe("isSafeHref", () => {
  it("accepts relative URLs", () => {
    expect(isSafeHref("/some/path")).toBe(true);
    expect(isSafeHref("./relative")).toBe(true);
    expect(isSafeHref("../up")).toBe(true);
    expect(isSafeHref("#anchor")).toBe(true);
    expect(isSafeHref("?query=1")).toBe(true);
    expect(isSafeHref("page.html")).toBe(true);
  });

  it("accepts legitimate colon-bearing relative references", () => {
    // A colon before any "/", "?", or "#" is a scheme separator; a colon after
    // one keeps the reference relative. These must stay allowed.
    expect(isSafeHref("/path:to")).toBe(true);
    expect(isSafeHref("?x:y")).toBe(true);
    expect(isSafeHref("#x:y")).toBe(true);
  });

  it("accepts http and https URLs (case-insensitive scheme)", () => {
    expect(isSafeHref("http://example.com/x")).toBe(true);
    expect(isSafeHref("https://example.com/x?y=1")).toBe(true);
    expect(isSafeHref("HTTP://EXAMPLE.COM")).toBe(true);
    expect(isSafeHref("HtTpS://example.com")).toBe(true);
  });

  it("rejects executable and data schemes", () => {
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref("JavaScript:alert(1)")).toBe(false);
    expect(isSafeHref("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeHref("vbscript:msgbox(1)")).toBe(false);
  });

  it("rejects non-http scheme URLs and non-string/empty values", () => {
    expect(isSafeHref("mailto:foo@example.com")).toBe(false);
    expect(isSafeHref("ftp://example.com")).toBe(false);
    expect(isSafeHref("")).toBe(false);
    expect(isSafeHref("   ")).toBe(false);
    expect(isSafeHref(null)).toBe(false);
    expect(isSafeHref(undefined)).toBe(false);
    expect(isSafeHref(42)).toBe(false);
  });

  it("rejects protocol-relative URLs beginning with //", () => {
    expect(isSafeHref("//example.com/x")).toBe(false);
    expect(isSafeHref("//evil.host/path?y=1")).toBe(false);
    expect(isSafeHref("///host")).toBe(false);
  });

  it("rejects backslash-prefixed / backslash-containing values", () => {
    // Browsers may normalize backslashes to slashes, so these can resolve to a
    // protocol-relative or external host.
    expect(isSafeHref("\\/\\/example.com")).toBe(false);
    expect(isSafeHref("\\example.com\\path")).toBe(false);
    expect(isSafeHref("\\host")).toBe(false);
    expect(isSafeHref("/path\\to")).toBe(false);
  });

  it("rejects scheme-like tokens with embedded whitespace", () => {
    // A colon before any "/?#" is treated as a scheme separator; anything other
    // than http/https (including whitespace-obfuscated schemes) is rejected.
    expect(isSafeHref("java\tscript:alert(1)")).toBe(false);
    expect(isSafeHref(" java script:alert(1)")).toBe(false);
  });

  it("rejects ASCII C0 control characters and DEL", () => {
    // Browser URL parsing can normalize embedded control characters into
    // host/path separators, leaking to an external or protocol-relative host
    // even inside an otherwise-relative path.
    expect(isSafeHref("\u0000//evil.example/x")).toBe(false);
    expect(isSafeHref("/\t/evil.example/x")).toBe(false);
    expect(isSafeHref("/\n/evil.example/x")).toBe(false);
    expect(isSafeHref("/\r/evil.example/x")).toBe(false);
    expect(isSafeHref("/\u007f/evil.example/x")).toBe(false);
  });
});

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

describe("normalizeGlobalNotice action.href safety", () => {
  const base = {
    id: "n1",
    version: "1",
    severity: "info" as const,
    title: "Title",
    message: "Message"
  };

  it("preserves a safe relative action href", () => {
    const notice = normalizeGlobalNotice({
      ...base,
      action: { label: "Read more", href: "/events/jp/1" }
    });
    expect(notice).not.toBeNull();
    expect(notice?.action).toEqual({ label: "Read more", href: "/events/jp/1" });
  });

  it("preserves an http/https action href", () => {
    const notice = normalizeGlobalNotice({
      ...base,
      action: { label: "Site", href: "https://example.com/x" }
    });
    expect(notice?.action?.href).toBe("https://example.com/x");
  });

  it("drops the action but still renders the notice for an unsafe href", () => {
    const notice = normalizeGlobalNotice({
      ...base,
      action: { label: "Bad", href: "javascript:alert(1)" }
    });
    expect(notice).not.toBeNull();
    expect(notice?.action).toBeUndefined();
  });

  it("keeps existing banner behavior: missing or invalid fields drop the entry", () => {
    expect(normalizeGlobalNotice({ ...base, id: "" })).toBeNull();
    expect(normalizeGlobalNotice({ ...base, severity: "bogus" })).toBeNull();
    expect(normalizeGlobalNotice({ ...base, title: "  " })).toBeNull();
    expect(normalizeGlobalNotice(null)).toBeNull();
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

describe("parseGlobalNoticesPayload integration", () => {
  it("drops unsafe action hrefs while keeping the notice", () => {
    const notices = parseGlobalNoticesPayload({
      status: "success",
      data: [
        {
          id: "n1",
          version: 1,
          severity: "warning",
          title: "T",
          message: "M",
          action: { label: "X", href: "data:text/html,x" }
        },
        {
          id: "n2",
          version: "2",
          severity: "info",
          title: "T2",
          message: "M2",
          action: { label: "Y", href: "https://example.com" }
        }
      ]
    });

    expect(notices).toHaveLength(2);
    expect(notices[0].action).toBeUndefined();
    expect(notices[1].action?.href).toBe("https://example.com");
  });

  it("returns an empty list for a broken envelope", () => {
    expect(parseGlobalNoticesPayload({ status: "error", data: [] })).toEqual([]);
    expect(parseGlobalNoticesPayload(null)).toEqual([]);
  });
});

describe("stripTrailingSlashes (codePointAt fix)", () => {
  it("does not regress on unicode and trailing-slash handling", () => {
    expect(stripTrailingSlashes("https://example.com/")).toBe("https://example.com");
    expect(stripTrailingSlashes("https://example.com")).toBe("https://example.com");
    expect(stripTrailingSlashes("///")).toBe("");
    expect(stripTrailingSlashes("a/★/")).toBe("a/★");
  });
});
