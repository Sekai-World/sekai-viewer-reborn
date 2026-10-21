<script lang="ts">
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import Icon from "@iconify/svelte";
  import { createI18nTranslator, getLocalI18nMessages } from "$lib/i18n/runtime";
  import type { PageProps } from "./$types";

  type PageData = PageProps["data"];
  type SourceId = NonNullable<PageData["source"]>["id"];
  type Metric = PageData["metric"];
  type MusicRecommendation = PageData["items"][number];

  const DEFAULT_INPUTS = {
    deckPower: "",
    deckBonus: "0",
    boostMultiplier: "1"
  };
  const FIELD_DETAIL_REASON_CODES = new Set([
    "invalid-schema",
    "incomplete-data",
    "mixed-data",
    "freshness-metadata-missing",
    "invalid-freshness"
  ]);
  const MODES = [
    { id: "jp-solo", labelKey: "musicRecommender.jpSolo", enabled: true },
    { id: "auto", labelKey: "musicRecommender.modeAuto", enabled: false },
    { id: "multi", labelKey: "musicRecommender.modeMulti", enabled: false },
    { id: "challenge", labelKey: "musicRecommender.modeChallenge", enabled: false },
    { id: "cheerful-carnival", labelKey: "musicRecommender.modeCheerfulCarnival", enabled: false },
    { id: "world-bloom", labelKey: "musicRecommender.modeWorldBloom", enabled: false }
  ] as const;
  const RECOMMENDATION_LIMIT = 10;

  let { data }: PageProps = $props();
  const fallbackMessages = getLocalI18nMessages(["common", "music-recommender"]);
  let messages = $state(fallbackMessages);
  let source = $state<SourceId>(getInitialSource());
  let metric = $state<Metric>(getInitialMetric());
  let deckPower = $state(getInitialInput("deckPower"));
  let deckBonus = $state(getInitialInput("deckBonus"));
  let boostMultiplier = $state(getInitialInput("boostMultiplier"));
  let skillRates = $state(getInitialSkillRates());
  let noSkill = $state(getInitialNoSkill());
  let isSubmitting = $state(false);
  let hasSubmittedInvalidForm = $state(false);
  let hasTouchedDeckPower = $state(false);
  const translate = $derived(createI18nTranslator(data.uiLocale, messages));

  function translateInterpolated(
    key: string,
    replacements: Record<string, string | number>
  ): string {
    return Object.entries(replacements).reduce(
      (message, [name, value]) => message.replaceAll(`{${name}}`, String(value)),
      translate(key)
    );
  }

  function inputValue(value: number | string | null | undefined, fallback: string): string {
    return value === null || value === undefined ? fallback : String(value);
  }

  function getInitialSource(): SourceId {
    return data.source?.id ?? data.inputs.source ?? "sekai-best";
  }

  function getInitialMetric(): Metric {
    return data.metric;
  }

  function getInitialInput(name: keyof typeof DEFAULT_INPUTS): string {
    return inputValue(data.inputs[name], DEFAULT_INPUTS[name]);
  }

  function getInitialSkillRates(): string[] {
    return Array.from({ length: 6 }, (_, index) =>
      inputValue(data.inputs.skillRates?.[index], "0")
    );
  }

  function getInitialNoSkill(): boolean {
    return data.inputs.noSkill === true;
  }

  function readText(event: Event): string {
    return event.currentTarget instanceof HTMLInputElement ? event.currentTarget.value : "";
  }

  function parseFinite(value: string): number | null {
    const parsed = Number(value.trim());
    return value.trim() !== "" && Number.isFinite(parsed) ? parsed : null;
  }

  function validateInput(
    value: string,
    kind: "nonNegative" | "positive" | "positiveInteger" | "skill"
  ): string | null {
    const parsed = parseFinite(value);
    if (parsed === null) return "musicRecommender.inputRequired";
    if (kind === "positive" && (!Number.isSafeInteger(parsed) || parsed <= 0))
      return "musicRecommender.deckPowerInvalid";
    if (kind === "positiveInteger" && (!Number.isSafeInteger(parsed) || parsed <= 0))
      return "musicRecommender.boostInvalid";
    if (kind === "skill" && parsed < 0) return "musicRecommender.skillRateInvalid";
    if (kind === "nonNegative" && parsed < 0) return "musicRecommender.inputRequired";
    return null;
  }

  const inputErrors = $derived({
    deckPower: validateInput(deckPower, "positive"),
    deckBonus: validateInput(deckBonus, "nonNegative"),
    boostMultiplier: validateInput(boostMultiplier, "positiveInteger"),
    skillRates: noSkill
      ? skillRates.map(() => null)
      : skillRates.map((value) => validateInput(value, "skill"))
  });
  const shouldShowInitialDeckPowerError = $derived(
    data.inputs.deckPower !== null ||
      data.invalidFields.includes("deckPower") ||
      data.missingFields.some((field) => field !== "deckPower")
  );
  const deckPowerError = $derived(
    deckPower === "" &&
      !hasTouchedDeckPower &&
      !hasSubmittedInvalidForm &&
      !shouldShowInitialDeckPowerError
      ? null
      : inputErrors.deckPower
  );
  const hasInvalidInputs = $derived(
    Boolean(
      deckPowerError ||
      inputErrors.deckBonus ||
      inputErrors.boostMultiplier ||
      inputErrors.skillRates.some(Boolean)
    )
  );
  const results = $derived(data.items);
  const recommendedResults = $derived(results.slice(0, RECOMMENDATION_LIMIT));
  const sourceLabel = $derived(
    data.source === null
      ? translate("musicRecommender.sourceUnavailable")
      : translate(
          data.source.id === "moesekai"
            ? "musicRecommender.sourceMoesekai"
            : "musicRecommender.sourceSelfHosted"
        )
  );
  const formulaVersion = $derived(data.formulaVersion);
  const sourceHash = $derived(data.sourceHash ?? data.provenance?.contentHash ?? null);
  const sourceLastModifiedAt = $derived(data.provenance?.freshness.lastModifiedAt ?? null);
  const shouldShowFieldDetails = $derived(
    data.status === "unavailable" &&
      data.reasonCode !== null &&
      FIELD_DETAIL_REASON_CODES.has(data.reasonCode) &&
      (data.missingFields.length > 0 || data.invalidFields.length > 0)
  );

  function getUnavailableMessageKey(reasonCode: string | null): string {
    switch (reasonCode) {
      case "invalid-source":
        return "musicRecommender.invalidSource";
      case "fetch-failed":
        return "musicRecommender.fetchError";
      case "http-error":
        return "musicRecommender.httpError";
      case "stale-data":
        return "musicRecommender.staleData";
      case "invalid-json":
        return "musicRecommender.invalidJson";
      case "invalid-schema":
        return "musicRecommender.invalidSchema";
      case "incomplete-data":
        return "musicRecommender.incompleteData";
      case "mixed-data":
        return "musicRecommender.mixedData";
      case "freshness-metadata-missing":
        return "musicRecommender.freshnessMetadataMissing";
      case "invalid-freshness":
        return "musicRecommender.invalidFreshness";
      case "missing-inputs":
        return "musicRecommender.missingInputs";
      case "invalid-inputs":
        return "musicRecommender.invalidInputs";
      case "unsupported-region":
        return "musicRecommender.unsupportedRegion";
      case "unsupported-mode":
        return "musicRecommender.unsupportedMode";
      default:
        return "musicRecommender.unavailable";
    }
  }

  $effect(() => {
    void Promise.resolve(data.i18nMessages).then((next) => {
      messages = { ...fallbackMessages, ...next };
    });
  });

  function sourceChanged(event: Event): void {
    if (!(event.currentTarget instanceof HTMLSelectElement)) return;
    const next = event.currentTarget.value;
    if (next !== "sekai-best" && next !== "moesekai") return;
    source = next;
    void reloadWithQuery({ source: next });
  }

  async function reloadWithQuery(overrides: Record<string, string>): Promise<void> {
    if (!browser) return;
    const url = new URL(window.location.href);
    Object.entries(overrides).forEach(([key, value]) => url.searchParams.set(key, value));
    isSubmitting = true;
    try {
      await goto(`${url.pathname}?${url.searchParams.toString()}`, {
        invalidateAll: true,
        keepFocus: true,
        noScroll: true,
        replaceState: true
      });
    } finally {
      isSubmitting = false;
    }
  }

  function submitControls(event: SubmitEvent): void {
    event.preventDefault();
    hasTouchedDeckPower = true;
    hasSubmittedInvalidForm = hasInvalidInputs;
    if (hasInvalidInputs) return;
    hasSubmittedInvalidForm = false;
    void reloadWithQuery({
      source,
      metric,
      mode: "jp-solo",
      deckPower,
      deckBonus,
      boostMultiplier,
      skillRates: noSkill ? "" : skillRates.join(","),
      noSkill: String(noSkill)
    });
  }

  function resetInputs(): void {
    deckPower = DEFAULT_INPUTS.deckPower;
    deckBonus = DEFAULT_INPUTS.deckBonus;
    boostMultiplier = DEFAULT_INPUTS.boostMultiplier;
    skillRates = Array.from({ length: 6 }, () => "0");
    noSkill = false;
    hasTouchedDeckPower = false;
    hasSubmittedInvalidForm = false;
  }

  function formatNumber(value: number | null): string {
    return value === null
      ? translate("musicRecommender.notAvailable")
      : new Intl.NumberFormat(data.uiLocale).format(value);
  }

  function formatDuration(value: number | null): string {
    if (value === null || value < 0) return translate("musicRecommender.notAvailable");
    const totalSeconds = Math.floor(value / 1_000);
    return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
  }

  function metricValue(result: MusicRecommendation): number {
    return metric === "score" ? result.score : result.eventPoints;
  }
</script>

<svelte:head><title>{translate("musicRecommender.title")} | Sekai Tools</title></svelte:head>

<div class="music-recommender-page">
  <header class="music-recommender-header">
    <div>
      <p class="eyebrow">{translate("musicRecommender.jpSolo")}</p>
      <h1 id="music-recommender-title">{translate("musicRecommender.title")}</h1>
      <p>{translate("musicRecommender.description")}</p>
    </div>
    <div class="mode-strip" aria-label={translate("musicRecommender.mode")} role="group">
      {#each MODES as mode (mode.id)}
        <button
          type="button"
          class="mode-option"
          class:mode-option-active={mode.enabled}
          disabled={!mode.enabled}
          aria-pressed={mode.enabled}
        >
          {translate(mode.labelKey)}
          {#if !mode.enabled}<span class="mode-unavailable"
              >{translate("musicRecommender.unsupported")}</span
            >{/if}
        </button>
      {/each}
    </div>
  </header>

  <section class="source-bar" aria-labelledby="source-heading">
    <div>
      <p class="section-kicker" id="source-heading">{translate("musicRecommender.source")}</p>
      <p class="source-summary">
        {translate("musicRecommender.sourceSelected")}: <strong>{sourceLabel}</strong>
      </p>
    </div>
    <div class="source-control">
      <label for="music-source">{translate("musicRecommender.source")}</label>
      <select
        id="music-source"
        class="select select-bordered min-h-11"
        value={source}
        onchange={sourceChanged}
        disabled={isSubmitting}
      >
        <option value="sekai-best">{translate("musicRecommender.sourceSelfHosted")}</option>
        <option value="moesekai">{translate("musicRecommender.sourceMoesekai")}</option>
      </select>
      <p class="source-hint">{translate("musicRecommender.sourceSwitchHint")}</p>
    </div>
  </section>

  <div class="workbench-grid">
    <section class="control-panel" aria-labelledby="controls-heading">
      <div class="section-heading">
        <div>
          <p class="section-kicker">{translate("musicRecommender.jpSolo")}</p>
          <h2 id="controls-heading">{translate("musicRecommender.controls")}</h2>
        </div>
        <Icon icon="mdi:tune-variant" class="size-5 text-primary" aria-hidden="true" />
      </div>
      <p class="panel-description">{translate("musicRecommender.controlsDescription")}</p>

      <form class="controls-form" onsubmit={submitControls} novalidate>
        <div class="input-grid">
          <label class="field">
            <span>{translate("musicRecommender.deckPower")}</span>
            <input
              class="input input-bordered min-h-11"
              class:input-error={Boolean(deckPowerError)}
              type="text"
              inputmode="numeric"
              min="1"
              step="1"
              placeholder={translate("musicRecommender.deckPowerPlaceholder")}
              value={deckPower}
              oninput={(event) => {
                hasTouchedDeckPower = true;
                deckPower = readText(event);
              }}
              aria-invalid={Boolean(deckPowerError)}
            />
            {#if deckPowerError}<small class="field-error" role="alert"
                >{translate(deckPowerError)}</small
              >{/if}
          </label>
          <label class="field">
            <span>{translate("musicRecommender.deckBonus")}</span>
            <input
              class="input input-bordered min-h-11"
              class:input-error={Boolean(inputErrors.deckBonus)}
              type="text"
              inputmode="decimal"
              value={deckBonus}
              oninput={(event) => (deckBonus = readText(event))}
              aria-invalid={Boolean(inputErrors.deckBonus)}
            />
            {#if inputErrors.deckBonus}<small class="field-error" role="alert"
                >{translate(inputErrors.deckBonus)}</small
              >{/if}
          </label>
          <label class="field">
            <span>{translate("musicRecommender.boostMultiplier")}</span>
            <input
              class="input input-bordered min-h-11"
              class:input-error={Boolean(inputErrors.boostMultiplier)}
              type="text"
              inputmode="decimal"
              value={boostMultiplier}
              oninput={(event) => (boostMultiplier = readText(event))}
              aria-invalid={Boolean(inputErrors.boostMultiplier)}
            />
            {#if inputErrors.boostMultiplier}<small class="field-error" role="alert"
                >{translate(inputErrors.boostMultiplier)}</small
              >{/if}
          </label>
        </div>

        <fieldset class="skill-fieldset">
          <legend>{translate("musicRecommender.skillRates")}</legend>
          <label class="no-skill-toggle">
            <input class="toggle toggle-primary" type="checkbox" bind:checked={noSkill} />
            <span
              ><strong>{translate("musicRecommender.noSkill")}</strong><small
                >{translate("musicRecommender.noSkillDescription")}</small
              ></span
            >
          </label>
          <div class="skill-grid">
            {#each skillRates as rate, index (index)}
              <label class="field">
                <span
                  >{translateInterpolated("musicRecommender.skillRate", {
                    number: index + 1
                  })}</span
                >
                <input
                  class="input input-bordered min-h-11"
                  class:input-error={Boolean(inputErrors.skillRates[index])}
                  type="text"
                  inputmode="decimal"
                  value={rate}
                  disabled={noSkill}
                  oninput={(event) => (skillRates[index] = readText(event))}
                  aria-invalid={Boolean(inputErrors.skillRates[index])}
                />
                {#if inputErrors.skillRates[index]}<small class="field-error" role="alert"
                    >{translate(inputErrors.skillRates[index]!)}</small
                  >{/if}
              </label>
            {/each}
          </div>
        </fieldset>

        <div class="form-actions">
          <button class="btn btn-primary min-h-11 flex-1" type="submit" disabled={isSubmitting}>
            <Icon icon="mdi:refresh" class="size-4" aria-hidden="true" />
            {translate("musicRecommender.recalculate")}
          </button>
          <button
            class="btn btn-ghost min-h-11"
            type="button"
            onclick={resetInputs}
            disabled={isSubmitting}
          >
            <Icon icon="mdi:restore" class="size-4" aria-hidden="true" />
            {translate("musicRecommender.reset")}
          </button>
        </div>
      </form>
    </section>

    <section class="results-panel" aria-labelledby="results-heading" aria-busy={isSubmitting}>
      <div class="results-heading">
        <div>
          <p class="section-kicker">{translate("musicRecommender.jpSolo")}</p>
          <h2 id="results-heading">{translate("musicRecommender.results")}</h2>
        </div>
        <label class="metric-control">
          <span>{translate("musicRecommender.metric")}</span>
          <select
            class="select select-bordered min-h-11"
            bind:value={metric}
            onchange={() => void reloadWithQuery({ metric })}
            disabled={isSubmitting}
          >
            <option value="score">{translate("musicRecommender.scoreMetric")}</option>
            <option value="eventPoints">{translate("musicRecommender.eventPointsMetric")}</option>
          </select>
        </label>
      </div>

      {#if isSubmitting}
        <div class="results-state" role="status">
          <div class="result-skeleton" aria-hidden="true">
            <span class="skeleton h-5 w-12"></span><span class="skeleton h-5 w-2/3"></span><span
              class="skeleton h-5 w-24"
            ></span>
          </div>
          <div class="result-skeleton" aria-hidden="true">
            <span class="skeleton h-5 w-12"></span><span class="skeleton h-5 w-1/2"></span><span
              class="skeleton h-5 w-24"
            ></span>
          </div>
          <span class="sr-only">{translate("musicRecommender.loading")}</span>
        </div>
      {:else if data.status === "unavailable"}
        <div class="results-state" role="alert">
          <Icon icon="mdi:file-alert-outline" class="size-7 text-error" aria-hidden="true" />
          <p>{translate(getUnavailableMessageKey(data.reasonCode))}</p>
          {#if data.reasonCode === "fetch-failed" || data.reasonCode === "http-error"}
            <small>{translate("musicRecommender.fetchErrorDescription")}</small>
          {/if}
          {#if shouldShowFieldDetails}
            {#if data.missingFields.length > 0}
              <small
                >{translate("musicRecommender.missingFields")}: {data.missingFields.join(
                  ", "
                )}</small
              >
            {/if}
            {#if data.invalidFields.length > 0}
              <small
                >{translate("musicRecommender.invalidFields")}: {data.invalidFields.join(
                  ", "
                )}</small
              >
            {/if}
          {/if}
        </div>
      {:else if hasInvalidInputs || hasSubmittedInvalidForm}
        <div class="results-state" role="status">
          <Icon icon="mdi:alert-circle-outline" class="size-7 text-warning" aria-hidden="true" />
          <p>{translate("musicRecommender.incomplete")}</p>
        </div>
      {:else if results.length === 0}
        <div class="results-state" role="status">
          <Icon icon="mdi:music-note-off-outline" class="size-7 text-primary" aria-hidden="true" />
          <p>{translate("musicRecommender.empty")}</p>
          <small>{translate("musicRecommender.emptyDescription")}</small>
        </div>
      {:else}
        <div class="results-table-wrap">
          <table class="results-table">
            <caption class="sr-only">{translate("musicRecommender.results")}</caption>
            <thead
              ><tr
                ><th scope="col">{translate("musicRecommender.rank")}</th><th scope="col"
                  >{translate("musicRecommender.song")}</th
                ><th scope="col">{translate("musicRecommender.difficulty")}</th><th
                  scope="col"
                  class="numeric"
                  >{metric === "score"
                    ? translate("musicRecommender.score")
                    : translate("musicRecommender.eventPoints")}</th
                ><th scope="col" class="numeric"
                  >{translate("musicRecommender.durationMetadata")}</th
                ></tr
              ></thead
            >
            <tbody>
              {#each recommendedResults as result (`${result.musicId}-${result.difficulty}-${result.rank}`)}
                <tr>
                  <td class="rank-cell">{result.rank}</td>
                  <th scope="row">
                    <span class="song-id"
                      >{translateInterpolated("musicRecommender.songId", {
                        id: result.musicId
                      })}</span
                    >
                  </th>
                  <td><span class="difficulty-badge">{result.difficulty}</span></td>
                  <td class="numeric result-value">{formatNumber(metricValue(result))}</td>
                  <td class="numeric duration-cell">{formatDuration(result.musicTime * 1_000)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <p class="metadata-note">
          <Icon icon="mdi:information-outline" class="size-4" aria-hidden="true" />{translate(
            "musicRecommender.durationNotRanked"
          )}
        </p>
      {/if}
    </section>
  </div>

  <section class="provenance-panel" aria-labelledby="provenance-heading">
    <div class="provenance-heading">
      <Icon icon="mdi:shield-check-outline" class="size-5 text-primary" aria-hidden="true" />
      <h2 id="provenance-heading">{translate("musicRecommender.provenance")}</h2>
    </div>
    <dl class="provenance-grid">
      <div>
        <dt>{translate("musicRecommender.sourceSelected")}</dt>
        <dd>{sourceLabel}</dd>
      </div>
      <div>
        <dt>{translate("musicRecommender.formulaVersion")}</dt>
        <dd>{formulaVersion}</dd>
      </div>
      <div>
        <dt>{translate("musicRecommender.sourceHash")}</dt>
        <dd class="provenance-code">{sourceHash ?? translate("musicRecommender.notAvailable")}</dd>
      </div>
      <div>
        <dt>{translate("musicRecommender.lastModified")}</dt>
        <dd class="provenance-code">
          {sourceLastModifiedAt ?? translate("musicRecommender.notAvailable")}
        </dd>
      </div>
    </dl>
    {#if data.source}
      <a class="source-link" href={data.source.url} target="_blank" rel="noreferrer">
        {translate("musicRecommender.openSource")}<Icon
          icon="mdi:open-in-new"
          class="size-4"
          aria-hidden="true"
        />
      </a>
    {/if}
  </section>
</div>

<style>
  .music-recommender-page {
    display: grid;
    gap: 1.25rem;
    min-width: 0;
    min-height: 100%;
    padding-block: 1rem 2rem;
    overflow-x: clip;
  }
  .music-recommender-header,
  .source-bar,
  .control-panel,
  .results-panel,
  .provenance-panel {
    border: 1px solid var(--archive-border-subtle);
    background: var(--archive-surface-default);
    border-radius: var(--radius-box);
  }
  .music-recommender-header {
    display: grid;
    gap: 1.5rem;
    padding: clamp(1.25rem, 3vw, 2rem);
    background: var(--archive-surface-raised);
  }
  .eyebrow,
  .section-kicker {
    margin: 0 0 0.4rem;
    color: var(--color-primary);
    font-size: 0.72rem;
    font-weight: 800;
    text-transform: uppercase;
  }
  h1,
  h2 {
    font-weight: 800;
    letter-spacing: 0;
  }
  h1 {
    max-width: 18ch;
    font-size: 2.25rem;
    line-height: 1;
  }
  h2 {
    font-size: 1.35rem;
    line-height: 1.1;
  }
  .music-recommender-header p:not(.eyebrow),
  .panel-description {
    max-width: 48rem;
    margin-top: 0.75rem;
    color: var(--archive-text-muted);
    line-height: 1.55;
  }
  .mode-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: stretch;
  }
  .mode-option {
    display: inline-flex;
    min-height: 2.75rem;
    align-items: center;
    gap: 0.4rem;
    border: 1px solid var(--archive-border-subtle);
    border-radius: 9999px;
    padding: 0.55rem 0.8rem;
    background: var(--archive-surface-sunken);
    color: var(--archive-text-muted);
    font-size: 0.78rem;
    font-weight: 700;
  }
  .mode-option-active {
    border-color: color-mix(in oklab, var(--color-primary) 42%, var(--archive-border-subtle));
    background: color-mix(in oklab, var(--color-primary) 12%, var(--archive-surface-default));
    color: var(--color-primary);
  }
  .mode-option:disabled {
    cursor: not-allowed;
    opacity: 0.62;
  }
  .mode-unavailable {
    font-size: 0.66rem;
    font-weight: 600;
  }
  .source-bar {
    display: grid;
    gap: 1rem;
    padding: 1rem 1.25rem;
    background: var(--archive-surface-raised);
  }
  .source-summary {
    color: var(--archive-text-muted);
    font-size: 0.88rem;
  }
  .source-summary strong {
    color: var(--archive-text-default);
  }
  .source-control {
    display: grid;
    gap: 0.4rem;
  }
  .source-control label,
  .metric-control span,
  .field > span {
    font-size: 0.78rem;
    font-weight: 750;
  }
  .source-hint {
    color: var(--archive-text-muted);
    font-size: 0.75rem;
    line-height: 1.45;
  }
  .workbench-grid {
    display: grid;
    gap: 1.25rem;
    min-width: 0;
    align-items: start;
  }
  .control-panel,
  .results-panel {
    min-width: 0;
    padding: 1.25rem;
  }
  .section-heading,
  .results-heading,
  .provenance-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }
  .controls-form {
    display: grid;
    gap: 1.25rem;
    margin-top: 1.25rem;
  }
  .input-grid,
  .skill-grid {
    display: grid;
    gap: 0.75rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .field {
    display: grid;
    gap: 0.4rem;
    min-width: 0;
  }
  .field-error {
    color: var(--color-error);
    font-size: 0.72rem;
    line-height: 1.35;
  }
  .skill-fieldset {
    display: grid;
    gap: 0.8rem;
    border-top: 1px solid var(--archive-border-subtle);
    padding-top: 1rem;
  }
  .skill-fieldset legend {
    margin-bottom: 0.1rem;
    font-size: 0.78rem;
    font-weight: 800;
  }
  .no-skill-toggle {
    display: flex;
    min-height: 2.75rem;
    align-items: center;
    gap: 0.75rem;
  }
  .no-skill-toggle span {
    display: grid;
    gap: 0.18rem;
  }
  .no-skill-toggle small {
    color: var(--archive-text-muted);
    font-size: 0.73rem;
    line-height: 1.35;
  }
  .form-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  .results-heading {
    align-items: end;
    margin-bottom: 1rem;
  }
  .metric-control {
    display: grid;
    gap: 0.4rem;
    min-width: min(100%, 14rem);
  }
  .results-state {
    display: grid;
    min-height: 19rem;
    place-content: center;
    justify-items: center;
    gap: 0.65rem;
    padding: 2rem;
    text-align: center;
    color: var(--archive-text-muted);
  }
  .results-state p {
    max-width: 32rem;
    color: var(--archive-text-default);
    font-weight: 750;
  }
  .results-state small {
    max-width: 34rem;
    line-height: 1.5;
  }
  .result-skeleton {
    display: grid;
    width: min(100%, 38rem);
    grid-template-columns: 3rem 1fr 6rem;
    gap: 1rem;
    padding: 1rem 0;
    border-bottom: 1px solid var(--archive-border-subtle);
  }
  .results-table-wrap {
    min-width: 0;
    overflow-x: auto;
  }
  .results-table {
    width: 100%;
    min-width: 38rem;
    border-collapse: collapse;
    font-size: 0.86rem;
  }
  .results-table th,
  .results-table td {
    border-bottom: 1px solid var(--archive-border-subtle);
    padding: 0.9rem 0.65rem;
    text-align: left;
    vertical-align: middle;
  }
  .results-table thead th {
    color: var(--archive-text-muted);
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .results-table .numeric {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .rank-cell {
    width: 3.5rem;
    color: var(--archive-text-muted);
    font-variant-numeric: tabular-nums;
  }
  .song-id {
    display: block;
  }
  .song-id {
    margin-top: 0.2rem;
    color: var(--archive-text-muted);
    font-size: 0.72rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  .difficulty-badge {
    display: inline-flex;
    border: 1px solid var(--archive-border-subtle);
    border-radius: 0.45rem;
    padding: 0.25rem 0.45rem;
    background: var(--archive-surface-sunken);
    color: var(--archive-text-muted);
    font-size: 0.72rem;
    font-weight: 700;
  }
  .result-value {
    color: var(--color-primary);
    font-weight: 800;
  }
  .duration-cell {
    color: var(--archive-text-muted);
  }
  .metadata-note {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: 0.75rem;
    color: var(--archive-text-muted);
    font-size: 0.75rem;
  }
  .provenance-panel {
    display: grid;
    gap: 1rem;
    padding: 1rem 1.25rem;
    background: var(--archive-surface-sunken);
  }
  .provenance-heading {
    align-items: center;
    justify-content: flex-start;
  }
  .provenance-grid {
    display: grid;
    gap: 0.85rem;
    margin: 0;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .provenance-grid div {
    min-width: 0;
  }
  .provenance-grid dt {
    color: var(--archive-text-muted);
    font-size: 0.7rem;
    font-weight: 750;
  }
  .provenance-grid dd {
    margin-top: 0.25rem;
    overflow-wrap: anywhere;
    font-size: 0.8rem;
  }
  .provenance-code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  .source-link {
    display: inline-flex;
    min-height: 2.75rem;
    align-items: center;
    gap: 0.45rem;
    justify-self: start;
    color: var(--color-primary);
    font-size: 0.8rem;
    font-weight: 750;
    text-decoration: none;
  }
  @media (min-width: 48rem) {
    .source-bar {
      grid-template-columns: 1fr minmax(18rem, 28rem);
      align-items: center;
    }
    .workbench-grid {
      grid-template-columns: minmax(18rem, 0.72fr) minmax(0, 1.28fr);
    }
    .music-recommender-header {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: end;
    }
    .mode-strip {
      justify-content: flex-end;
      max-width: 34rem;
    }
    h1 {
      font-size: 2.75rem;
    }
  }
  @media (min-width: 64rem) {
    .input-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 39.999rem) {
    .music-recommender-page,
    .workbench-grid {
      grid-template-columns: minmax(0, 1fr);
    }
    .input-grid,
    .skill-grid,
    .provenance-grid {
      grid-template-columns: 1fr;
    }
    .results-heading {
      align-items: stretch;
      flex-direction: column;
    }
    .metric-control {
      width: 100%;
    }
    .form-actions > * {
      width: 100%;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .music-recommender-page * {
      scroll-behavior: auto !important;
    }
  }
</style>
