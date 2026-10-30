// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/svelte";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JP_SOLO_FORMULA_VERSION, MUSIC_META_SOURCES } from "#lib/music-recommender.js";
import { makeDefaultPlanInputs } from "#lib/target-plan-query.js";
import { goto } from "../lib/test/app-navigation";
import type { PageData } from "./music-recommender/$types";
import MusicRecommenderPage from "./music-recommender/+page.svelte";

vi.mock("$app/env", () => ({ browser: true, dev: false }));

const panelPath = resolve(process.cwd(), "src/routes/music-recommender/TargetPlanPanel.svelte");
const messagesPath = resolve(
  process.cwd(),
  "../../packages/i18n-source/tools-site/music-recommender.json"
);

type Plan = PageData["plan"];

const createPageData = (
  plan: Plan = { status: "idle", inputs: makeDefaultPlanInputs() }
): PageData => ({
  status: "available",
  source: MUSIC_META_SOURCES["sekai-best"],
  metric: "eventPoints",
  inputs: {
    source: "sekai-best",
    metric: "eventPoints",
    mode: "jp-solo",
    deckPower: 200000,
    deckBonus: 0,
    boostMultiplier: 1,
    skillRates: Array.from({ length: 6 }, () => 0),
    noSkill: false
  },
  items: [
    { rank: 1, musicId: 11, difficulty: "master", musicTime: 120, score: 5, eventPoints: 4_100 }
  ],
  formulaVersion: JP_SOLO_FORMULA_VERSION,
  provenance: null,
  sourceHash: null,
  reasonCode: null,
  reason: null,
  missingFields: [],
  invalidFields: [],
  plan,
  uiLocale: "en",
  i18nMessages: {},
  globalNotices: [],
  siteVersion: "test"
});

const readyPlan = (): Plan => ({
  status: "ready",
  inputs: { ...makeDefaultPlanInputs(), target: "10000" },
  plan: {
    status: "ready",
    objective: "fewestPlays",
    metric: "eventPoints",
    target: 10_000,
    maxPlays: 100,
    allowRepeats: true,
    optimality: "optimal",
    items: [
      {
        musicId: 3,
        difficulty: "expert",
        plays: 1,
        yieldPerPlay: 2_000,
        subtotal: 2_000,
        required: true
      },
      {
        musicId: 11,
        difficulty: "master",
        plays: 2,
        yieldPerPlay: 4_100,
        subtotal: 8_200,
        required: false
      }
    ],
    plays: 3,
    total: 10_200,
    totals: { score: 130_000_000, eventPoints: 10_200 },
    overshoot: 200,
    objectiveValue: 3
  }
});

const renderPage = (data: PageData) =>
  render(MusicRecommenderPage, { params: {}, data, form: null });

const planSection = (): HTMLElement =>
  screen.getByRole("heading", { name: "Target plan" }).closest("section") as HTMLElement;

const targetInput = (): HTMLInputElement => screen.getByLabelText(/Target total/);

const submitPlan = () => fireEvent.click(screen.getByRole("button", { name: "Make plan" }));

beforeEach(() => {
  goto.mockClear();
});

afterEach(() => {
  cleanup();
});

describe("target plan panel inputs", () => {
  it("renders labelled controls with the defaults", () => {
    renderPage(createPageData());

    expect(targetInput().value).toBe("");
    expect(screen.getByLabelText("Optimize for")).toBeTruthy();
    expect((screen.getByLabelText("Maximum lives") as HTMLInputElement).value).toBe("100");
    expect(screen.getByRole("group", { name: "Difficulties to use" })).toBeTruthy();
    expect(
      screen.getAllByRole("checkbox", { name: /easy|normal|hard|expert|master|append/ })
    ).toHaveLength(6);
    expect(screen.getByText("Enter a target total to see how many lives it takes.")).toBeTruthy();
  });

  it("labels the target with the metric chosen for the recommendations", () => {
    renderPage(createPageData());

    expect(screen.getByLabelText("Target total event points")).toBeTruthy();
  });

  it("holds feedback until submit, then flags and describes an invalid target", async () => {
    renderPage(createPageData());

    expect(screen.queryByRole("alert")).toBeNull();
    await submitPlan();

    const input = targetInput();
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("plan-target-error");
    expect(screen.getByText("Enter a whole number from 1 to 100,000,000,000.")).toBeTruthy();
    expect(goto).not.toHaveBeenCalled();

    await fireEvent.input(input, { target: { value: "12.5" } });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    await fireEvent.input(input, { target: { value: "12500" } });
    expect(input.getAttribute("aria-invalid")).toBe("false");
    expect(screen.queryByText("Enter a whole number from 1 to 100,000,000,000.")).toBeNull();
  });

  it.each([
    ["Maximum lives", "0", "Enter a whole number from 1 to 10,000."],
    ["Maximum lives", "10001", "Enter a whole number from 1 to 10,000."]
  ])("rejects %s of %s", async (label, value, message) => {
    renderPage(createPageData());
    await fireEvent.input(targetInput(), { target: { value: "5000" } });
    await fireEvent.input(screen.getByLabelText(label), { target: { value } });

    await submitPlan();

    expect(screen.getByText(message)).toBeTruthy();
    expect(goto).not.toHaveBeenCalled();
  });

  it("requires at least one difficulty", async () => {
    renderPage(createPageData());
    await fireEvent.input(targetInput(), { target: { value: "5000" } });
    for (const box of screen.getAllByRole("checkbox", {
      name: /easy|normal|hard|expert|master|append/
    })) {
      await fireEvent.click(box);
    }

    await submitPlan();

    expect(screen.getByText("Select at least one difficulty.")).toBeTruthy();
    expect(goto).not.toHaveBeenCalled();
  });

  it("rejects malformed required songs", async () => {
    renderPage(createPageData());
    await fireEvent.input(targetInput(), { target: { value: "5000" } });
    await fireEvent.input(screen.getByLabelText(/Songs that must be played/), {
      target: { value: "twelve" }
    });

    await submitPlan();

    expect(
      screen.getByText("Use the form 12:master, separated by commas, with each song listed once.")
    ).toBeTruthy();
    expect(goto).not.toHaveBeenCalled();
  });
});

describe("target plan panel submission", () => {
  it("sends the deck settings together with the plan settings", async () => {
    renderPage(createPageData());
    await fireEvent.input(targetInput(), { target: { value: " 10000 " } });
    await fireEvent.change(screen.getByLabelText("Optimize for"), {
      target: { value: "leastOvershoot" }
    });
    await fireEvent.input(screen.getByLabelText("Maximum lives"), { target: { value: "25" } });
    await fireEvent.click(screen.getByRole("checkbox", { name: "easy" }));
    await fireEvent.click(screen.getByRole("checkbox", { name: "normal" }));
    await fireEvent.input(screen.getByLabelText(/Songs that must be played/), {
      target: { value: "3:master" }
    });

    await submitPlan();

    expect(goto).toHaveBeenCalledTimes(1);
    const url = new URL(String(goto.mock.calls[0]?.[0]), "https://tools.example.test");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      deckPower: "200000",
      metric: "eventPoints",
      mode: "jp-solo",
      target: "10000",
      objective: "leastOvershoot",
      maxPlays: "25",
      repeats: "true",
      difficulties: "hard,expert,master,append",
      required: "3:master"
    });
  });

  it("does not send a plan while the deck settings are invalid", async () => {
    const data = createPageData();
    renderPage({ ...data, inputs: { ...data.inputs, deckPower: null } });
    await fireEvent.input(targetInput(), { target: { value: "10000" } });

    await submitPlan();

    expect(goto).not.toHaveBeenCalled();
    expect(screen.getByText("Fix the deck settings above first.")).toBeTruthy();
  });

  it("shows a loading state while the request is in flight", async () => {
    goto.mockImplementationOnce(() => new Promise(() => {}));
    renderPage(createPageData());
    await fireEvent.input(targetInput(), { target: { value: "10000" } });

    await submitPlan();

    expect(within(planSection()).getByRole("status").textContent).toContain("Planning lives");
    expect(planSection().getAttribute("aria-busy")).toBe("true");
    expect((screen.getByRole("button", { name: "Make plan" }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });
});

describe("target plan panel results", () => {
  it("shows the plan, its totals, and why it is trustworthy", () => {
    renderPage(createPageData(readyPlan()));

    const section = within(planSection());
    expect(section.getByText("No plan uses fewer lives under these settings.")).toBeTruthy();
    const summary = planSection().querySelector("dl.plan-summary") as HTMLElement;
    expect(within(summary).getByText("Lives").nextElementSibling?.textContent).toBe("3");
    expect(within(summary).getByText("Total event points").nextElementSibling?.textContent).toBe(
      "10,200"
    );
    expect(within(summary).getByText("Over the target by").nextElementSibling?.textContent).toBe(
      "200"
    );
    expect(within(summary).getByText("Total score").nextElementSibling?.textContent).toBe(
      "130,000,000"
    );

    const rows = section.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Required")).toBeTruthy();
    expect(within(rows[1]).getByText("8,200")).toBeTruthy();
    expect(section.getByText(new RegExp(`formula ${JP_SOLO_FORMULA_VERSION}`))).toBeTruthy();
    expect(section.getByText(/Energy and time are not part of the plan/)).toBeTruthy();
  });

  it("labels a finished plan with the metric it was calculated for", () => {
    // The recommender is now showing score, but this plan was made for event points.
    renderPage({ ...createPageData(readyPlan()), metric: "score" });

    const summary = planSection().querySelector("dl.plan-summary") as HTMLElement;
    expect(within(summary).getByText("Total event points").nextElementSibling?.textContent).toBe(
      "10,200"
    );
    expect(within(summary).getByText("Total score").nextElementSibling?.textContent).toBe(
      "130,000,000"
    );
    expect(within(summary).getByText("Target total event points")).toBeTruthy();
    // The form still follows the metric chosen for the recommendations.
    expect(screen.getByLabelText("Target total score")).toBeTruthy();
  });

  it("describes the least-overshoot guarantee", () => {
    const plan = readyPlan();
    if (plan.status !== "ready") throw new Error("fixture");
    renderPage(
      createPageData({
        ...plan,
        plan: { ...plan.plan, objective: "leastOvershoot", objectiveValue: 200 }
      })
    );

    expect(
      screen.getByText("No plan gets closer to the target under these settings.")
    ).toBeTruthy();
  });

  it.each([
    ["plays-limit", "The target cannot be reached within the maximum number of lives."],
    [
      "target-unreachable",
      "The target cannot be reached with these songs. Allow repeats or add difficulties."
    ],
    ["no-candidates", "No songs match the selected difficulties."],
    ["required-unavailable", "A required song is not available with these settings."],
    ["invalid-input", "Check the plan settings and try again."]
  ] as const)("explains an unavailable plan: %s", (reason, message) => {
    renderPage(
      createPageData({
        status: "unavailable",
        inputs: makeDefaultPlanInputs(),
        reason,
        invalidFields: [],
        bound: null
      })
    );

    expect(within(planSection()).getByRole("alert").textContent).toContain(message);
  });

  it("explains a request beyond the exact-solver bounds and what to change", () => {
    renderPage(
      createPageData({
        status: "unavailable",
        inputs: makeDefaultPlanInputs(),
        reason: "out-of-bounds",
        invalidFields: [],
        bound: { name: "sumSpan", limit: 5_000_000, actual: 11_000_000 }
      })
    );

    const alert = within(planSection()).getByRole("alert");
    expect(alert.textContent).toContain("This request is too large to solve exactly.");
    expect(alert.textContent).toContain("choose fewest lives");
  });

  it("says a plan is waiting for yields when the recommendations are unavailable", () => {
    renderPage(
      createPageData({
        status: "unavailable",
        inputs: makeDefaultPlanInputs(),
        reason: "yields-unavailable",
        invalidFields: [],
        bound: null
      })
    );

    expect(within(planSection()).getByRole("alert").textContent).toContain(
      "A plan needs per-live values"
    );
  });

  it("shows the plan's own input errors when they arrive from the URL", () => {
    renderPage(
      createPageData({
        status: "invalid",
        inputs: { ...makeDefaultPlanInputs(), target: "abc" },
        missingFields: [],
        invalidFields: ["target"]
      })
    );

    expect(targetInput().value).toBe("abc");
    expect(screen.getByText("Enter a whole number from 1 to 100,000,000,000.")).toBeTruthy();
    expect(within(planSection()).getAllByRole("alert").length).toBeGreaterThan(0);
  });

  it("restores the submitted controls from the page data", () => {
    renderPage(
      createPageData({
        status: "idle",
        inputs: {
          target: "7500",
          objective: "leastOvershoot",
          maxPlays: "12",
          allowRepeats: false,
          difficulties: ["master", "append"],
          requiredSongs: "5:master"
        }
      })
    );

    expect(targetInput().value).toBe("7500");
    expect((screen.getByLabelText("Optimize for") as HTMLSelectElement).value).toBe(
      "leastOvershoot"
    );
    expect((screen.getByLabelText("Maximum lives") as HTMLInputElement).value).toBe("12");
    expect((screen.getByRole("checkbox", { name: "master" }) as HTMLInputElement).checked).toBe(
      true
    );
    expect((screen.getByRole("checkbox", { name: "easy" }) as HTMLInputElement).checked).toBe(
      false
    );
    expect((screen.getByLabelText(/Songs that must be played/) as HTMLInputElement).value).toBe(
      "5:master"
    );
  });
});

describe("target plan panel source", () => {
  it("only uses message keys that exist in the source dictionary", async () => {
    const [source, messages] = await Promise.all([
      readFile(panelPath, "utf8"),
      readFile(messagesPath, "utf8").then((text) => JSON.parse(text) as Record<string, string>)
    ]);
    const keys = new Set(source.match(/musicRecommender\.[A-Za-z]+/g) ?? []);

    expect(keys.size).toBeGreaterThan(30);
    for (const key of keys) expect(messages[key], key).toBeTruthy();
  });

  it("does not run the planner in the browser", async () => {
    const source = await readFile(panelPath, "utf8");

    expect(source).not.toMatch(/\bplanTarget\(/);
    expect(source).not.toContain("target-planner.js");
  });
});
