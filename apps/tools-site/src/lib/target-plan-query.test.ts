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
        maxLiveBonus: "",
        overhead: "",
        allowRepeats: true,
        difficulties: [],
        requiredSongs: ""
      },
      request: {
        target: 500000,
        objective: "fewestPlays",
        maxPlays: 50,
        maxLiveBonus: null,
        overhead: null,
        allowRepeats: true,
        allowedDifficulties: null,
        requiredSongs: []
      }
    });
  });

  it("reads the optional overhead per live, zero included, and treats a blank one as not entered", () => {
    expect(parse(`${base}&overhead=45`)).toMatchObject({
      status: "ready",
      inputs: { overhead: "45" },
      request: { overhead: 45 }
    });
    expect(parse(`${base}&overhead=0`)).toMatchObject({ request: { overhead: 0 } });
    expect(parse(`${base}&overhead=3600`)).toMatchObject({ request: { overhead: 3600 } });
    expect(parse(`${base}&overhead=`)).toMatchObject({
      status: "ready",
      request: { overhead: null }
    });
  });

  it.each(["3601", "-1", "1.5", "1e2", "abc", "45&overhead=50"])(
    "rejects the overhead %s and echoes what was typed",
    (value) => {
      expect(parse(`${base}&overhead=${value}`)).toMatchObject({
        status: "invalid",
        invalidFields: ["overhead"]
      });
    }
  );

  it("accepts the shortest play time with an overhead and repeats", () => {
    const query = base.replace("objective=fewestPlays", "objective=shortestTime");

    expect(parse(`${query}&overhead=60`)).toMatchObject({
      status: "ready",
      request: { objective: "shortestTime", overhead: 60, allowRepeats: true }
    });
  });

  it("refuses the shortest play time without an overhead: none is assumed", () => {
    const query = base.replace("objective=fewestPlays", "objective=shortestTime");

    expect(parse(query)).toMatchObject({
      status: "invalid",
      inputs: { objective: "shortestTime", overhead: "" },
      missingFields: ["overhead"],
      invalidFields: []
    });
    expect(parse(`${query}&overhead=`)).toMatchObject({ missingFields: ["overhead"] });
    // A malformed overhead is invalid, not missing.
    expect(parse(`${query}&overhead=x`)).toMatchObject({
      missingFields: [],
      invalidFields: ["overhead"]
    });
  });

  it("refuses the shortest play time without repeats", () => {
    const query = base
      .replace("objective=fewestPlays", "objective=shortestTime")
      .replace("repeats=true", "repeats=false");

    expect(parse(`${query}&overhead=60`)).toMatchObject({
      status: "invalid",
      missingFields: [],
      invalidFields: ["repeats"]
    });
    // The other objectives keep accepting it.
    expect(parse(`${base.replace("repeats=true", "repeats=false")}&overhead=60`)).toMatchObject({
      status: "ready"
    });
  });

  it("reads an optional live bonus limit and treats a blank one as no limit", () => {
    expect(parse(`${base}&maxLiveBonus=120`)).toMatchObject({
      status: "ready",
      inputs: { maxLiveBonus: "120" },
      request: { maxLiveBonus: 120 }
    });
    expect(parse(`${base}&maxLiveBonus=1000000`)).toMatchObject({
      request: { maxLiveBonus: 1_000_000 }
    });
    expect(parse(`${base}&maxLiveBonus=`)).toMatchObject({
      status: "ready",
      request: { maxLiveBonus: null }
    });
    expect(parse(`${base}&maxLiveBonus=%20`)).toMatchObject({
      status: "ready",
      request: { maxLiveBonus: null }
    });
  });

  it.each(["0", "-5", "1.5", "1e3", "abc", "1000001"])(
    "rejects the live bonus limit %s instead of ignoring it",
    (value) => {
      expect(parse(`${base}&maxLiveBonus=${value}`)).toMatchObject({
        status: "invalid",
        inputs: { maxLiveBonus: value },
        invalidFields: ["maxLiveBonus"]
      });
    }
  );

  it("rejects a repeated live bonus limit and starts a plan request from it alone", () => {
    expect(parse(`${base}&maxLiveBonus=10&maxLiveBonus=20`)).toMatchObject({
      status: "invalid",
      invalidFields: ["maxLiveBonus"]
    });
    expect(parse("maxLiveBonus=10")).toMatchObject({
      status: "invalid",
      missingFields: ["maxPlays", "objective", "repeats", "target"]
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
      maxLiveBonus: " 300 ",
      overhead: " 45 ",
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
        maxLiveBonus: 300,
        overhead: 45,
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
      request: { allowedDifficulties: null, requiredSongs: [], maxLiveBonus: null }
    });
  });
});
