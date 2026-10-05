import { afterEach, describe, expect, it, vi } from "vitest";
import { Curve } from "./Curve.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Curve", () => {
  it("defaults to identity and composes transformations without mutating the source", () => {
    const identity = new Curve();
    const square = new Curve((t) => t * t);

    expect(identity.p(0.4)).toBe(0.4);
    expect(square.p(0.4)).toBeCloseTo(0.16);
    expect(square.reverse().p(0.4)).toBeCloseTo(0.36);
    expect(square.p(0.4)).toBeCloseTo(0.16);
  });

  it("uses the rising, plateau, and falling portions of a bounce curve", () => {
    const bounce = new Curve().bounce(0.2, 0.2);

    expect(bounce.p(0.1)).toBeCloseTo(0.5);
    expect(bounce.p(0.5)).toBe(1);
    expect(bounce.p(0.9)).toBeCloseTo(0.5);
  });

  it("interpolates deterministic wiggle points and returns zero at the endpoint", () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0.25).mockReturnValueOnce(0.75);
    const wiggle = new Curve().wiggle(2, 0.1, 0.9);

    expect(wiggle.p(0)).toBe(0.1);
    expect(wiggle.p(0.5)).toBeCloseTo(0.5);
    expect(wiggle.p(1)).toBe(0);
    expect(Math.random).toHaveBeenCalledTimes(2);
  });

  it("applies sine and exponential easing, including their endpoint special cases", () => {
    expect(new Curve().ease().p(0)).toBeCloseTo(0);
    expect(new Curve().ease().p(0.5)).toBeCloseTo(0.5);
    expect(new Curve().ease().p(1)).toBeCloseTo(1);

    expect(new Curve().easeOutExpo().p(0)).toBe(0);
    expect(new Curve().easeOutExpo().p(1)).toBe(1);
    expect(new Curve().easeOutQuad().p(0.5)).toBeCloseTo(0.75);

    expect(new Curve().easeInExpo().p(0)).toBe(0);
    expect(new Curve().easeInExpo().p(1)).toBe(1);
    expect(new Curve().easeInExpo().p(0.5)).toBeCloseTo(Math.pow(2, -5));
  });

  it("wraps loop and offset inputs and shrinks to its configured terminal value", () => {
    expect(new Curve().loop(2).p(0.75)).toBe(0.5);
    expect(new Curve().offset(0.25).p(0)).toBe(0.75);
    expect(new Curve().shrink(0.5, -1).p(0.25)).toBe(0.5);
    expect(new Curve().shrink(0.5, -1).p(0.5)).toBe(-1);
  });

  it("maps an input range and multiplies the mapped values of two curves", () => {
    const mapped = new Curve((t) => t * 2).map_range(10, 20, 0, 2);
    const multiplied = new Curve((t) => t + 1).multiply(new Curve((t) => 2 * t));

    expect(mapped.p(0.5)).toBe(15);
    expect(new Curve().map_range(2, 6).p(0.25)).toBe(3);
    expect(multiplied.p(0.5)).toBe(1.5);
  });
});
