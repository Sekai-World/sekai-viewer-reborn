import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAN_MAX_PLAYS,
  buildPlanQuery,
  makeDefaultPlanInputs,
  parseTargetPlanQuery
} from "#lib/target-plan-query.js";

const parse = (query: string) => parseTargetPlanQuery(new URLSearchParams(query));
const base = "target=500000&objective=fewestPlays&maxPlays=50&repeats=true";

describe("parseTargetPlanQuery", () => {
  it("is idle with defaults when no plan control is present", () => {
    expect(parse("")).toEqual({ status: "idle", inputs: makeDefaultPlanInputs() });
    expect(parse("metric=score&deckPower=200000")).toMatchObject({ status: "idle" });
    expect(makeDefaultPlanInputs()).toMatchObject({
      objective: "fewestPlays",
      maxPlays: DEFAULT_PLAN_MAX_PLAYS,
      allowRepeats: true
    });
  });

  it("parses a complete request with every difficulty allowed by default", () => {
    expect(parse(base)).toEqual({
      status: "ready",
      inputs: {
        target: "500000",
        objective: "fewestPlays",
        maxPlays: "50",
        allowRepeats: true,
        difficulties: [],
        requiredSongs: ""
      },
      request: {
        target: 500000,
        objective: "fewestPlays",
        maxPlays: 50,
        allowRepeats: true,
        allowedDifficulties: null,
        requiredSongs: []
      }
    });
  });

  it("parses difficulties, required songs, and the other objective", () => {
    const result = parse(
      `target=1200&objective=leastOvershoot&maxPlays=9&repeats=false&difficulties=master, expert&required=12:master, 45:expert`
    );

    expect(result).toMatchObject({
      status: "ready",
      request: {
        objective: "leastOvershoot",
        allowRepeats: false,
        allowedDifficulties: ["master", "expert"],
        requiredSongs: [
          { musicId: 12, difficulty: "master" },
          { musicId: 45, difficulty: "expert" }
        ]
      }
    });
  });

  it.each([
    ["target", "target=&objective=fewestPlays&maxPlays=5&repeats=true"],
    ["target", "target=0&objective=fewestPlays&maxPlays=5&repeats=true"],
    ["target", "target=1.5&objective=fewestPlays&maxPlays=5&repeats=true"],
    ["target", "target=1e5&objective=fewestPlays&maxPlays=5&repeats=true"],
    ["target", "target=-5&objective=fewestPlays&maxPlays=5&repeats=true"],
    ["target", "target=100000000001&objective=fewestPlays&maxPlays=5&repeats=true"],
    ["objective", "target=5&objective=cheapest&maxPlays=5&repeats=true"],
    ["maxPlays", "target=5&objective=fewestPlays&maxPlays=0&repeats=true"],
    ["maxPlays", "target=5&objective=fewestPlays&maxPlays=10001&repeats=true"],
    ["repeats", "target=5&objective=fewestPlays&maxPlays=5&repeats=maybe"],
    ["difficulties[1]", `${base}&difficulties=master,extreme`],
    ["difficulties[1]", `${base}&difficulties=master,master`],
    ["required[0]", `${base}&required=12`],
    ["required[0]", `${base}&required=0:master`],
    ["required[1]", `${base}&required=12:master,12:master`],
    ["required[1]", `${base}&required=12:master,`],
    ["required[0]", `${base}&required=12:extreme`]
  ])("flags %s as invalid for %s", (field, query) => {
    const result = parse(query);

    expect(result).toMatchObject({ status: "invalid" });
    expect(result.status === "invalid" && result.invalidFields).toContain(field);
  });

  it("reports the missing controls when only some are given", () => {
    const result = parse("target=500");

    expect(result).toMatchObject({
      status: "invalid",
      missingFields: ["maxPlays", "objective", "repeats"],
      invalidFields: []
    });
  });

  it("treats a repeated parameter as invalid instead of picking one", () => {
    const result = parse(`${base}&target=700`);

    expect(result).toMatchObject({ status: "invalid", invalidFields: ["target"] });
  });

  it("echoes what was typed when the request is invalid", () => {
    const result = parse(
      "target=abc&objective=leastOvershoot&maxPlays=0&repeats=false&required=zz"
    );

    expect(result.inputs).toMatchObject({
      target: "abc",
      objective: "leastOvershoot",
      maxPlays: "0",
      allowRepeats: false,
      requiredSongs: "zz"
    });
  });
});

describe("buildPlanQuery", () => {
  it("round-trips a form submission through the parser", () => {
    const inputs = {
      target: " 750000 ",
      objective: "leastOvershoot" as const,
      maxPlays: "20",
      allowRepeats: false,
      difficulties: ["master" as const, "append" as const],
      requiredSongs: " 3:master "
    };
    const query = new URLSearchParams(buildPlanQuery(inputs));

    expect(parseTargetPlanQuery(query)).toMatchObject({
      status: "ready",
      request: {
        target: 750000,
        objective: "leastOvershoot",
        maxPlays: 20,
        allowRepeats: false,
        allowedDifficulties: ["master", "append"],
        requiredSongs: [{ musicId: 3, difficulty: "master" }]
      }
    });
  });

  it("allows every difficulty and no required songs when those are empty", () => {
    const query = new URLSearchParams(
      buildPlanQuery({ ...makeDefaultPlanInputs(), target: "5000" })
    );

    expect(parseTargetPlanQuery(query)).toMatchObject({
      status: "ready",
      request: { allowedDifficulties: null, requiredSongs: [] }
    });
  });
});
