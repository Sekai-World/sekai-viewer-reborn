import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ dev: false }));

vi.mock("$app/env", () => ({
  get dev() {
    return env.dev;
  }
}));

import { load } from "./+page.server";

type LoadEvent = Parameters<typeof load>[0];

describe("Chibi developer preview loader", () => {
  beforeEach(() => {
    env.dev = false;
  });

  it("does not exist outside the dev server", () => {
    expect(() => load({} as LoadEvent)).toThrow(expect.objectContaining({ status: 404 }));
  });

  it("loads in the dev server", () => {
    env.dev = true;

    expect(load({} as LoadEvent)).toEqual({});
  });
});
