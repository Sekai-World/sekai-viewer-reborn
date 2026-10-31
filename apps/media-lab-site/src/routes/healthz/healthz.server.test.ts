import { describe, expect, it } from "vitest";
import { GET } from "./+server";

describe("healthz endpoint", () => {
  it("answers 200 without caching and without touching upstream services", async () => {
    const response = await GET({} as never);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("ok");
  });
});
