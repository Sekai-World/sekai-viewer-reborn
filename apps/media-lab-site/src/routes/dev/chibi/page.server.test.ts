import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ dev: false }));

vi.mock("$app/env", () => ({
  get dev() {
    return env.dev;
  }
}));

import { load } from "./+page.server";

// The loader reads nothing from its event, so it is called without one.
const runLoad = load as () => ReturnType<typeof load>;

describe("Chibi developer preview loader", () => {
  beforeEach(() => {
    env.dev = false;
  });

  it("does not exist outside the dev server", () => {
    expect(() => runLoad()).toThrow(expect.objectContaining({ status: 404 }));
  });

  it("loads in the dev server", () => {
    env.dev = true;

    expect(runLoad()).toEqual({});
  });
});
