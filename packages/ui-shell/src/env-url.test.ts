import { describe, expect, it } from "vitest";
import { envUrl } from "./env-url";

const secret = "token-7f3a9c";

describe("envUrl", () => {
  it("keeps unset and blank values optional by default", () => {
    const validate = envUrl();
    expect(validate(undefined)).toBe("");
    expect(validate("")).toBe("");
    expect(validate("   ")).toBe("   ");
  });

  it("rejects unset and blank values when required", () => {
    const validate = envUrl({ required: true });
    expect(() => validate(undefined)).toThrow("Value is required.");
    expect(() => validate("")).toThrow("Value is required.");
    expect(() => validate("  ")).toThrow("Value is required.");
  });

  it("returns absolute http(s) URLs unchanged", () => {
    const validate = envUrl({ required: true });
    expect(validate("https://api.example.com/api/v1/")).toBe("https://api.example.com/api/v1/");
    expect(validate(" http://sekai-api.sekai-viewer.svc.cluster.local ")).toBe(
      " http://sekai-api.sekai-viewer.svc.cluster.local "
    );
  });

  it("rejects malformed URLs without echoing the value", () => {
    const validate = envUrl();
    for (const value of [
      `api.example.com/${secret}`,
      `localhost:18080/${secret}`,
      `ftp://files.example.com/${secret}`,
      `https:cdn.example.com/${secret}`,
      `http:/cdn.example.com/${secret}`,
      `/storage/${secret}`,
      `//cdn.example.com/${secret}`
    ]) {
      // anchored: the message is exactly this text, so the value cannot leak into logs
      expect(() => validate(value)).toThrow(/^Value must be an absolute http\(s\) URL\.$/);
    }
  });

  it("accepts root-relative paths only when allowed", () => {
    const validate = envUrl({ allowPath: true });
    expect(validate("/storage")).toBe("/storage");
    expect(validate("https://storage.sekai.best")).toBe("https://storage.sekai.best");
    for (const value of [
      "/\\storage.sekai.best",
      "/\\/storage.sekai.best",
      "https:storage.sekai.best"
    ]) {
      expect(() => validate(value)).toThrow(
        "Value must be an absolute http(s) URL or a path starting with /."
      );
    }
    expect(() => validate("//storage.sekai.best")).toThrow(
      "Value must be an absolute http(s) URL or a path starting with /."
    );
    expect(() => validate("storage")).toThrow(
      "Value must be an absolute http(s) URL or a path starting with /."
    );
  });
});
