<script lang="ts">
  import Icon from "@iconify/svelte";
  import { MUSIC_META_DIFFICULTIES } from "#lib/music-recommender.js";
  import {
    buildPlanQuery,
    parseTargetPlanQuery,
    type PlanFormInputs
  } from "#lib/target-plan-query.js";
  import type { PageProps } from "./$types";

  type PageData = PageProps["data"];
  type Metric = PageData["metric"];
  type Props = {
    plan: PageData["plan"];
    metric: Metric;
    sourceLabel: string;
    formulaVersion: string;
    busy: boolean;
    translate: (key: string) => string;
    formatNumber: (value: number | null) => string;
    /** Returns false when the request was not sent, for example because the deck inputs are invalid. */
    onSubmit: (params: Record<string, string>) => boolean;
  };

  let {
    plan,
    metric,
    sourceLabel,
    formulaVersion,
    busy,
    translate,
    formatNumber,
    onSubmit
  }: Props = $props();

  let target = $state(getInitialInputs().target);
  let objective = $state(getInitialInputs().objective);
  let maxPlays = $state(getInitialInputs().maxPlays);
  let allowRepeats = $state(getInitialInputs().allowRepeats);
  let selectedDifficulties = $state<string[]>(getInitialDifficulties());
  let requiredSongs = $state(getInitialInputs().requiredSongs);
  let hasSubmitted = $state(false);
  let isDeckBlocked = $state(false);

  function getInitialInputs(): PlanFormInputs {
    return plan.inputs;
  }

  function getInitialDifficulties(): string[] {
    const chosen = plan.inputs.difficulties;
    return chosen.length > 0 ? [...chosen] : [...MUSIC_META_DIFFICULTIES];
  }

  function interpolate(key: string, values: Record<string, string | number>): string {
    return Object.entries(values).reduce(
      (message, [name, value]) => message.replaceAll(`{${name}}`, String(value)),
      translate(key)
    );
  }

  function readText(event: Event): string {
    return event.currentTarget instanceof HTMLInputElement ? event.currentTarget.value : "";
  }

  function toggleDifficulty(difficulty: string): void {
    selectedDifficulties = selectedDifficulties.includes(difficulty)
      ? selectedDifficulties.filter((entry) => entry !== difficulty)
      : [...selectedDifficulties, difficulty];
  }

  const formValues = $derived<PlanFormInputs>({
    target,
    objective,
    maxPlays,
    allowRepeats,
    // Every difficulty selected means no restriction, which is how the query expresses it.
    difficulties:
      selectedDifficulties.length === MUSIC_META_DIFFICULTIES.length
        ? []
        : MUSIC_META_DIFFICULTIES.filter((difficulty) => selectedDifficulties.includes(difficulty)),
    requiredSongs
  });
  const parsed = $derived(parseTargetPlanQuery(new URLSearchParams(buildPlanQuery(formValues))));
  const problemFields = $derived(
    parsed.status === "invalid" ? [...parsed.missingFields, ...parsed.invalidFields] : []
  );
  const showErrors = $derived(hasSubmitted || plan.status === "invalid");
  const errors = $derived({
    target: problemFields.includes("target") ? "musicRecommender.planTargetInvalid" : null,
    maxPlays: problemFields.includes("maxPlays") ? "musicRecommender.planMaxPlaysInvalid" : null,
    difficulties:
      selectedDifficulties.length === 0 ? "musicRecommender.planDifficultiesRequired" : null,
    required: problemFields.some((field) => field.startsWith("required"))
      ? "musicRecommender.planRequiredInvalid"
      : null
  });
  const hasErrors = $derived(
    Boolean(errors.target || errors.maxPlays || errors.difficulties || errors.required)
  );

  function labelFor(target: Metric): string {
    return translate(
      target === "score"
        ? "musicRecommender.planMetricScore"
        : "musicRecommender.planMetricEventPoints"
    );
  }

  // The form follows the metric chosen for the recommendations; a finished plan describes the
  // metric it was calculated for, even if the selection has changed since.
  const metricLabel = $derived(labelFor(metric));
  const resultMetric = $derived<Metric>(plan.status === "ready" ? plan.plan.metric : metric);
  const resultMetricLabel = $derived(labelFor(resultMetric));
  const otherResultMetricLabel = $derived(
    labelFor(resultMetric === "score" ? "eventPoints" : "score")
  );

  function submit(event: SubmitEvent): void {
    event.preventDefault();
    hasSubmitted = true;
    isDeckBlocked = false;
    if (hasErrors) return;
    isDeckBlocked = !onSubmit(buildPlanQuery(formValues));
  }

  function getUnavailableMessageKey(reason: string): string {
    switch (reason) {
      case "yields-unavailable":
        return "musicRecommender.planYieldsUnavailable";
      case "no-candidates":
        return "musicRecommender.planNoCandidates";
      case "required-unavailable":
        return "musicRecommender.planRequiredUnavailable";
      case "plays-limit":
        return "musicRecommender.planPlaysLimit";
      case "target-unreachable":
        return "musicRecommender.planTargetUnreachable";
      case "out-of-bounds":
        return "musicRecommender.planOutOfBounds";
      default:
        return "musicRecommender.planInvalidSettings";
    }
  }
</script>

<section class="plan-panel" aria-labelledby="plan-heading" aria-busy={busy}>
  <div class="plan-heading">
    <div>
      <p class="section-kicker">{translate("musicRecommender.jpSolo")}</p>
      <h2 id="plan-heading">{translate("musicRecommender.planTitle")}</h2>
    </div>
    <Icon icon="mdi:tune-variant" class="size-5 text-primary" aria-hidden="true" />
  </div>
  <p class="plan-description">{translate("musicRecommender.planDescription")}</p>

  <form class="plan-form" onsubmit={submit} novalidate>
    <div class="plan-grid">
      <label class="field">
        <span>{interpolate("musicRecommender.planTarget", { metric: metricLabel })}</span>
        <input
          id="plan-target"
          class="input input-bordered min-h-11"
          class:input-error={showErrors && Boolean(errors.target)}
          type="text"
          inputmode="numeric"
          value={target}
          oninput={(event) => (target = readText(event))}
          aria-invalid={showErrors && Boolean(errors.target)}
          aria-describedby={showErrors && errors.target ? "plan-target-error" : undefined}
        />
        {#if showErrors && errors.target}<small
            class="field-error"
            id="plan-target-error"
            role="alert">{translate(errors.target)}</small
          >{/if}
      </label>
      <label class="field">
        <span>{translate("musicRecommender.planObjective")}</span>
        <select
          id="plan-objective"
          class="select select-bordered min-h-11"
          bind:value={objective}
          disabled={busy}
        >
          <option value="fewestPlays">{translate("musicRecommender.planObjectiveFewest")}</option>
          <option value="leastOvershoot"
            >{translate("musicRecommender.planObjectiveLeastOvershoot")}</option
          >
        </select>
      </label>
      <label class="field">
        <span>{translate("musicRecommender.planMaxPlays")}</span>
        <input
          id="plan-max-plays"
          class="input input-bordered min-h-11"
          class:input-error={showErrors && Boolean(errors.maxPlays)}
          type="text"
          inputmode="numeric"
          value={maxPlays}
          oninput={(event) => (maxPlays = readText(event))}
          aria-invalid={showErrors && Boolean(errors.maxPlays)}
          aria-describedby={showErrors && errors.maxPlays ? "plan-max-plays-error" : undefined}
        />
        {#if showErrors && errors.maxPlays}<small
            class="field-error"
            id="plan-max-plays-error"
            role="alert">{translate(errors.maxPlays)}</small
          >{/if}
      </label>
      <label class="repeat-toggle">
        <input class="toggle toggle-primary" type="checkbox" bind:checked={allowRepeats} />
        <span
          ><strong>{translate("musicRecommender.planAllowRepeats")}</strong><small
            >{translate("musicRecommender.planAllowRepeatsDescription")}</small
          ></span
        >
      </label>
    </div>

    <fieldset class="plan-fieldset">
      <legend>{translate("musicRecommender.planDifficulties")}</legend>
      <div class="difficulty-options">
        {#each MUSIC_META_DIFFICULTIES as difficulty (difficulty)}
          <label class="difficulty-option">
            <input
              class="checkbox checkbox-primary"
              type="checkbox"
              checked={selectedDifficulties.includes(difficulty)}
              onchange={() => toggleDifficulty(difficulty)}
            />
            <span>{difficulty}</span>
          </label>
        {/each}
      </div>
      {#if showErrors && errors.difficulties}<small class="field-error" role="alert"
          >{translate(errors.difficulties)}</small
        >{/if}
    </fieldset>

    <label class="field">
      <span>{translate("musicRecommender.planRequired")}</span>
      <input
        id="plan-required"
        class="input input-bordered min-h-11"
        class:input-error={showErrors && Boolean(errors.required)}
        type="text"
        placeholder={translate("musicRecommender.planRequiredPlaceholder")}
        value={requiredSongs}
        oninput={(event) => (requiredSongs = readText(event))}
        aria-invalid={showErrors && Boolean(errors.required)}
        aria-describedby="plan-required-hint"
      />
      <small class="field-hint" id="plan-required-hint"
        >{translate("musicRecommender.planRequiredHint")}</small
      >
      {#if showErrors && errors.required}<small class="field-error" role="alert"
          >{translate(errors.required)}</small
        >{/if}
    </label>

    <div class="form-actions">
      <button class="btn btn-primary min-h-11 flex-1" type="submit" disabled={busy}>
        <Icon icon="mdi:refresh" class="size-4" aria-hidden="true" />
        {translate("musicRecommender.planSubmit")}
      </button>
    </div>
    {#if isDeckBlocked}
      <p class="field-error" role="alert">{translate("musicRecommender.planDeckInvalid")}</p>
    {/if}
  </form>

  <div class="plan-result" aria-live="polite">
    {#if busy}
      <div class="plan-state" role="status">
        <span class="skeleton h-5 w-2/3" aria-hidden="true"></span>
        <span class="skeleton h-5 w-1/2" aria-hidden="true"></span>
        <span class="sr-only">{translate("musicRecommender.planLoading")}</span>
      </div>
    {:else if plan.status === "idle"}
      <div class="plan-state">
        <Icon icon="mdi:information-outline" class="size-6 text-primary" aria-hidden="true" />
        <p>{translate("musicRecommender.planIdle")}</p>
      </div>
    {:else if plan.status === "invalid"}
      <div class="plan-state" role="alert">
        <Icon icon="mdi:alert-circle-outline" class="size-6 text-warning" aria-hidden="true" />
        <p>{translate("musicRecommender.planInvalidSettings")}</p>
      </div>
    {:else if plan.status === "unavailable"}
      <div class="plan-state" role="alert">
        <Icon icon="mdi:file-alert-outline" class="size-6 text-error" aria-hidden="true" />
        <p>{translate(getUnavailableMessageKey(plan.reason))}</p>
        {#if plan.reason === "out-of-bounds"}
          <small>{translate("musicRecommender.planOutOfBoundsHint")}</small>
        {/if}
        {#if plan.reason === "yields-unavailable"}
          <small>{translate("musicRecommender.planYieldsUnavailableHint")}</small>
        {/if}
      </div>
    {:else}
      <div class="plan-summary-block">
        <div class="plan-summary-heading">
          <h3>{translate("musicRecommender.planResult")}</h3>
          <p class="optimal-note">
            <Icon icon="mdi:shield-check-outline" class="size-4" aria-hidden="true" />
            {translate(
              plan.plan.objective === "fewestPlays"
                ? "musicRecommender.planOptimalFewest"
                : "musicRecommender.planOptimalLeastOvershoot"
            )}
          </p>
        </div>
        <dl class="plan-summary">
          <div>
            <dt>{translate("musicRecommender.planPlays")}</dt>
            <dd>{formatNumber(plan.plan.plays)}</dd>
          </div>
          <div>
            <dt>{interpolate("musicRecommender.planTarget", { metric: resultMetricLabel })}</dt>
            <dd>{formatNumber(plan.plan.target)}</dd>
          </div>
          <div>
            <dt>{interpolate("musicRecommender.planTotal", { metric: resultMetricLabel })}</dt>
            <dd>{formatNumber(plan.plan.total)}</dd>
          </div>
          <div>
            <dt>{translate("musicRecommender.planOvershoot")}</dt>
            <dd>{formatNumber(plan.plan.overshoot)}</dd>
          </div>
          <div>
            <dt>{interpolate("musicRecommender.planTotal", { metric: otherResultMetricLabel })}</dt>
            <dd>
              {formatNumber(
                plan.plan.metric === "score" ? plan.plan.totals.eventPoints : plan.plan.totals.score
              )}
            </dd>
          </div>
        </dl>

        <div class="plan-table-wrap">
          <table class="plan-table">
            <caption class="sr-only">{translate("musicRecommender.planResult")}</caption>
            <thead>
              <tr>
                <th scope="col">{translate("musicRecommender.song")}</th>
                <th scope="col">{translate("musicRecommender.difficulty")}</th>
                <th scope="col" class="numeric">{translate("musicRecommender.planPlays")}</th>
                <th scope="col" class="numeric">{translate("musicRecommender.planPerLive")}</th>
                <th scope="col" class="numeric">{translate("musicRecommender.planSubtotal")}</th>
              </tr>
            </thead>
            <tbody>
              {#each plan.plan.items as item (`${item.musicId}-${item.difficulty}`)}
                <tr>
                  <th scope="row">
                    {interpolate("musicRecommender.songId", { id: item.musicId })}
                    {#if item.required}<span class="required-badge"
                        >{translate("musicRecommender.planRequiredBadge")}</span
                      >{/if}
                  </th>
                  <td><span class="difficulty-badge">{item.difficulty}</span></td>
                  <td class="numeric">{formatNumber(item.plays)}</td>
                  <td class="numeric">{formatNumber(item.yieldPerPlay)}</td>
                  <td class="numeric result-value">{formatNumber(item.subtotal)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <ul class="plan-assumptions">
          <li>
            {interpolate("musicRecommender.planBasedOn", {
              source: sourceLabel,
              formula: formulaVersion
            })}
          </li>
          <li>{translate("musicRecommender.planAssumptionDeck")}</li>
          <li>{translate("musicRecommender.planAssumptionLimits")}</li>
        </ul>
      </div>
    {/if}
  </div>
</section>

<style>
  .plan-panel {
    display: grid;
    gap: 1rem;
    min-width: 0;
    border: 1px solid var(--archive-border-subtle);
    border-radius: var(--radius-box);
    padding: 1.25rem;
    background: var(--archive-surface-default);
  }
  .plan-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }
  .section-kicker {
    margin: 0 0 0.4rem;
    color: var(--color-primary);
    font-size: 0.72rem;
    font-weight: 800;
    text-transform: uppercase;
  }
  h2 {
    font-size: 1.35rem;
    font-weight: 800;
    line-height: 1.1;
  }
  h3 {
    font-size: 1rem;
    font-weight: 800;
  }
  .plan-description {
    max-width: 48rem;
    color: var(--archive-text-muted);
    line-height: 1.55;
  }
  .plan-form {
    display: grid;
    gap: 1.1rem;
  }
  .plan-grid {
    display: grid;
    gap: 0.75rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .field {
    display: grid;
    gap: 0.4rem;
    min-width: 0;
  }
  .field > span,
  .plan-fieldset legend {
    font-size: 0.78rem;
    font-weight: 750;
  }
  .field-hint {
    color: var(--archive-text-muted);
    font-size: 0.72rem;
    line-height: 1.35;
  }
  .field-error {
    color: var(--color-error);
    font-size: 0.72rem;
    line-height: 1.35;
  }
  .repeat-toggle {
    display: flex;
    min-height: 2.75rem;
    align-items: center;
    gap: 0.75rem;
  }
  .repeat-toggle span {
    display: grid;
    gap: 0.18rem;
  }
  .repeat-toggle small {
    color: var(--archive-text-muted);
    font-size: 0.73rem;
    line-height: 1.35;
  }
  .plan-fieldset {
    display: grid;
    gap: 0.6rem;
    border-top: 1px solid var(--archive-border-subtle);
    padding-top: 0.9rem;
  }
  .difficulty-options {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .difficulty-option {
    display: inline-flex;
    min-height: 2.75rem;
    align-items: center;
    gap: 0.5rem;
    border: 1px solid var(--archive-border-subtle);
    border-radius: 0.6rem;
    padding: 0.4rem 0.75rem;
    background: var(--archive-surface-sunken);
    font-size: 0.82rem;
    text-transform: capitalize;
  }
  .form-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  .plan-state {
    display: grid;
    justify-items: center;
    gap: 0.6rem;
    padding: 1.5rem 1rem;
    text-align: center;
    color: var(--archive-text-muted);
  }
  .plan-state p {
    max-width: 34rem;
    color: var(--archive-text-default);
    font-weight: 750;
  }
  .plan-state small {
    max-width: 34rem;
    line-height: 1.5;
  }
  .plan-summary-block {
    display: grid;
    gap: 1rem;
    min-width: 0;
  }
  .plan-summary-heading {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem 1rem;
  }
  .optimal-note {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--archive-text-muted);
    font-size: 0.78rem;
  }
  .plan-summary {
    display: grid;
    gap: 0.85rem;
    margin: 0;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .plan-summary dt {
    color: var(--archive-text-muted);
    font-size: 0.7rem;
    font-weight: 750;
  }
  .plan-summary dd {
    margin-top: 0.25rem;
    font-size: 1.05rem;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .plan-table-wrap {
    min-width: 0;
    overflow-x: auto;
  }
  .plan-table {
    width: 100%;
    min-width: 34rem;
    border-collapse: collapse;
    font-size: 0.86rem;
  }
  .plan-table th,
  .plan-table td {
    border-bottom: 1px solid var(--archive-border-subtle);
    padding: 0.8rem 0.65rem;
    text-align: left;
    vertical-align: middle;
  }
  .plan-table thead th {
    color: var(--archive-text-muted);
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .plan-table .numeric {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .result-value {
    color: var(--color-primary);
    font-weight: 800;
  }
  .difficulty-badge,
  .required-badge {
    display: inline-flex;
    border: 1px solid var(--archive-border-subtle);
    border-radius: 0.45rem;
    padding: 0.25rem 0.45rem;
    background: var(--archive-surface-sunken);
    color: var(--archive-text-muted);
    font-size: 0.72rem;
    font-weight: 700;
  }
  .required-badge {
    margin-left: 0.5rem;
    color: var(--color-primary);
  }
  .plan-assumptions {
    display: grid;
    gap: 0.3rem;
    padding-left: 1.1rem;
    color: var(--archive-text-muted);
    font-size: 0.75rem;
    line-height: 1.45;
    list-style: disc;
  }
  @media (max-width: 39.999rem) {
    .plan-grid,
    .plan-summary {
      grid-template-columns: 1fr;
    }
    .form-actions > * {
      width: 100%;
    }
  }
</style>
