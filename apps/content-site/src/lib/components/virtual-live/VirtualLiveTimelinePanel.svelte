<script lang="ts">
  import type {
    JsonValue,
    VirtualLiveTimelineCategory,
    VirtualLiveTimelineDocument,
    VirtualLiveTimelineEvent
  } from "$lib/domain/virtual-live-timeline";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { getLocalCharacterThumbnailAssetURL } from "$lib/assets/characters";
  import CharacterAvatar from "$lib/components/shared/CharacterAvatar.svelte";
  import VoicePlayButton from "$lib/components/shared/VoicePlayButton.svelte";

  const categories: VirtualLiveTimelineCategory[] = [
    "dialogue",
    "annotation",
    "cast",
    "performance",
    "stage",
    "audience",
    "audio",
    "other"
  ];
  const defaultCategories: VirtualLiveTimelineCategory[] = [
    "dialogue",
    "annotation",
    "cast",
    "audio"
  ];
  const batchSize = 100;

  type EnrichedTimelineEvent = VirtualLiveTimelineEvent & {
    gameCharacterId: number | null;
    displayName: string | null;
    voiceUrl: string | null;
    targetGameCharacterId: number | null;
    targetDisplayName: string | null;
  };

  let {
    document,
    status,
    retry,
    t
  }: {
    document: VirtualLiveTimelineDocument | null;
    status: "loading" | "error" | "ready";
    retry: () => void;
    t: (key: string, fallback?: string) => string;
  } = $props();

  let selectedCategories = $state<VirtualLiveTimelineCategory[]>(defaultCategories);
  let visibleLimit = $state(batchSize);
  const filteredEvents = $derived(
    document?.events.filter((event) => selectedCategories.includes(event.category)) ?? []
  );
  const visibleEvents = $derived(filteredEvents.slice(0, visibleLimit));
  const toggleCategory = (category: VirtualLiveTimelineCategory): void => {
    selectedCategories = selectedCategories.includes(category)
      ? selectedCategories.filter((item) => item !== category)
      : [...selectedCategories, category];
    visibleLimit = batchSize;
  };
  const selectAll = (): void => {
    selectedCategories = [...categories];
    visibleLimit = batchSize;
  };
  const formatTime = (seconds: number | null): string => {
    if (seconds === null) return t("virtualLiveTimelineTimeUnavailable");
    const minutes = Math.floor(seconds / 60);
    const remainder = (seconds % 60).toFixed(1).padStart(4, "0");
    return `${String(minutes).padStart(2, "0")}:${remainder}`;
  };
  const formatKey = (key: string): string =>
    key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replaceAll("_", " ");
  const formatValue = (value: JsonValue): string => {
    if (value === null) return t("virtualLiveValueUnavailable");
    if (typeof value === "boolean") {
      return value ? t("virtualLiveTimelineBooleanYes") : t("virtualLiveTimelineBooleanNo");
    }
    if (typeof value === "object") return JSON.stringify(value, null, 2);
    return String(value);
  };
  const getAttribute = (event: VirtualLiveTimelineEvent, keys: string[]): JsonValue | undefined => {
    for (const key of keys) if (key in event.attributes) return event.attributes[key];
    return undefined;
  };
  const getPrimaryKeys = (event: VirtualLiveTimelineEvent): string[] => {
    if (event.category === "dialogue") return ["serif"];
    if (event.category === "annotation") return ["comment"];
    if (event.category === "cast") return ["action", "name", "target"];
    if (event.category === "audio") return ["soundKey", "SoundKey"];
    return ["action", "name", "target", "value", "clip", "sound"];
  };
  const getPrimaryValue = (event: VirtualLiveTimelineEvent): JsonValue | undefined =>
    getAttribute(event, getPrimaryKeys(event));
  const asEnrichedEvent = (event: VirtualLiveTimelineEvent): EnrichedTimelineEvent =>
    event as EnrichedTimelineEvent;
  const hasGameCharacterId = (event: VirtualLiveTimelineEvent): boolean => {
    const characterId = asEnrichedEvent(event).gameCharacterId;
    return characterId !== null && Number.isSafeInteger(characterId) && characterId > 0;
  };
  const getCharacterDisplayName = (event: VirtualLiveTimelineEvent): string | null => {
    const displayName = asEnrichedEvent(event).displayName?.trim();
    if (displayName) return displayName;
    const characterName = event.characterName?.trim();
    return characterName || null;
  };
  const getCharacterHref = (event: VirtualLiveTimelineEvent): string | null =>
    hasGameCharacterId(event) && page.params.region
      ? resolve("/character/[region]/[id]", {
          region: page.params.region,
          id: String(asEnrichedEvent(event).gameCharacterId)
        })
      : null;
  const getRemainingAttributes = (event: VirtualLiveTimelineEvent): [string, JsonValue][] => {
    const consumed =
      event.category === "dialogue"
        ? [...getPrimaryKeys(event), "displayName", "speakerName"]
        : getPrimaryKeys(event);
    return Object.entries(event.attributes).filter(([key]) => !consumed.includes(key));
  };
  const categoryLabel = (category: VirtualLiveTimelineCategory): string =>
    t(`virtualLiveTimelineCategory.${category}`);
  const summary = (event: VirtualLiveTimelineEvent): string => {
    const primary = getPrimaryValue(event);
    if (primary !== undefined) return formatValue(primary);
    return t("virtualLiveTimelineEventSummary", "{category}: {type}")
      .replace("{category}", categoryLabel(event.category))
      .replace("{type}", formatKey(event.type));
  };
</script>

{#if status === "loading"}
  <div class="flex items-center justify-center gap-2 py-8 text-sm opacity-65" role="status">
    <span class="loading loading-spinner loading-sm" aria-hidden="true"></span>
    {t("virtualLiveTimelineLoading")}
  </div>
{:else if status === "error"}
  <div class="rounded-xl border border-error/20 bg-error/5 p-4 text-center text-sm">
    <p>{t("virtualLiveTimelineLoadFailed")}</p>
    <button type="button" class="btn btn-outline btn-sm mt-3" onclick={retry}
      >{t("virtualLiveTimelineRetry")}</button
    >
  </div>
{:else if document}
  <div class="space-y-3">
    <div class="flex flex-wrap gap-1.5" aria-label={t("virtualLiveTimelineFiltersLabel")}>
      {#each categories as category (category)}
        <button
          type="button"
          class={`btn btn-xs ${selectedCategories.includes(category) ? "btn-primary" : "btn-ghost border border-base-content/15"}`}
          aria-pressed={selectedCategories.includes(category)}
          onclick={() => toggleCategory(category)}
        >
          {categoryLabel(category)}
          <span class="opacity-65">{document.categoryCounts[category]}</span>
        </button>
      {/each}
      <button type="button" class="btn btn-xs btn-outline" onclick={selectAll}>
        {t("virtualLiveTimelineAllEvents")}
      </button>
    </div>
    <p class="text-xs opacity-60">
      {t("virtualLiveTimelineShowingCount")
        .replace("{shown}", String(visibleEvents.length))
        .replace("{total}", String(filteredEvents.length))}
    </p>

    <ol class="space-y-2">
      {#each visibleEvents as event (`${event.sourceIndex}-${event.type}`)}
        {@const remaining = getRemainingAttributes(event)}
        {@const enrichedEvent = asEnrichedEvent(event)}
        {@const characterDisplayName = getCharacterDisplayName(event)}
        {@const characterHref = getCharacterHref(event)}
        <li class="rounded-xl border border-base-content/10 bg-base-100/45 p-3">
          <div class="flex items-start gap-3">
            <time class="shrink-0 font-mono text-[0.68rem] font-semibold text-primary">
              {formatTime(event.startSec)}
            </time>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="badge badge-outline badge-xs">{categoryLabel(event.category)}</span>
                {#if event.category !== "stage" && event.type !== "motion"}
                  <span class="text-[0.68rem] opacity-55">{formatKey(event.type)}</span>
                {/if}
              </div>
              {#if event.category === "dialogue"}
                {#if characterDisplayName}
                  <div class="mt-1 flex items-center gap-2">
                    {#if characterHref}
                      <a href={characterHref} class="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" aria-label={characterDisplayName}>
                        <CharacterAvatar
                          src={getLocalCharacterThumbnailAssetURL(enrichedEvent.gameCharacterId)}
                          label={characterDisplayName}
                          characterId={enrichedEvent.gameCharacterId}
                          variant="xs"
                          decorative
                          imageClass="size-full object-contain"
                        />
                      </a>
                    {:else}
                      <CharacterAvatar src={null} label={characterDisplayName} variant="xs" decorative />
                    {/if}
                    <span class="text-xs font-semibold">{characterDisplayName}</span>
                  </div>
                {/if}
                <div class="mt-0.5 flex items-start gap-2">
                  <p class="min-w-0 flex-1 whitespace-pre-line text-sm/6">{formatValue(getAttribute(event, ["serif"]) ?? "")}</p>
                  {#if enrichedEvent.voiceUrl}<VoicePlayButton src={enrichedEvent.voiceUrl} playLabel={t("virtualLiveTimelineVoicePlay")} stopLabel={t("virtualLiveTimelineVoiceStop")} errorLabel={t("virtualLiveTimelineVoiceUnavailable")} class="shrink-0 scale-75 origin-right" />{/if}
                </div>
              {:else if event.category === "annotation"}
                {#if getPrimaryValue(event) !== undefined}
                  <p class="mt-1 whitespace-pre-line text-sm/6">{formatValue(getPrimaryValue(event)!)}</p>
                {/if}
              {:else if event.category === "cast"}
                {#if characterDisplayName}
                  <div class="mt-1 flex items-center gap-2">
                    {#if characterHref}
                      <a href={characterHref} class="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" aria-label={characterDisplayName}>
                        <CharacterAvatar
                          src={getLocalCharacterThumbnailAssetURL(enrichedEvent.gameCharacterId)}
                          label={characterDisplayName}
                          characterId={enrichedEvent.gameCharacterId}
                          variant="xs"
                          decorative
                          imageClass="size-full object-contain"
                        />
                      </a>
                    {:else}
                      <CharacterAvatar src={null} label={characterDisplayName} variant="xs" decorative />
                    {/if}
                    <span class="text-xs font-semibold">{characterDisplayName}</span>
                  </div>
                {/if}
              {:else if event.type === "lookAt"}
                <div class="mt-2 flex items-center gap-2">
                  <div class="flex min-w-0 items-center gap-2">
                    <CharacterAvatar src={getLocalCharacterThumbnailAssetURL(enrichedEvent.gameCharacterId)} label={characterDisplayName ?? ""} characterId={enrichedEvent.gameCharacterId} variant="xs" decorative />
                    {#if characterDisplayName}<span class="truncate text-xs font-semibold">{characterDisplayName}</span>{/if}
                  </div>
                  <span aria-hidden="true" class="text-lg opacity-55">→</span>
                  <div class="flex min-w-0 items-center gap-2">
                    <CharacterAvatar src={getLocalCharacterThumbnailAssetURL(enrichedEvent.targetGameCharacterId)} label={enrichedEvent.targetDisplayName ?? ""} characterId={enrichedEvent.targetGameCharacterId} variant="xs" decorative />
                    {#if enrichedEvent.targetDisplayName}<span class="truncate text-xs font-semibold">{enrichedEvent.targetDisplayName}</span>{/if}
                  </div>
                </div>
              {:else if event.type === "motion"}
                <div class="mt-2 flex items-start gap-2">
                  <CharacterAvatar src={getLocalCharacterThumbnailAssetURL(enrichedEvent.gameCharacterId)} label={characterDisplayName ?? ""} characterId={enrichedEvent.gameCharacterId} variant="xs" decorative />
                  <div class="min-w-0 space-y-0.5">
                    {#if characterDisplayName}<p class="truncate text-xs font-semibold">{characterDisplayName}</p>{/if}
                    {#if getAttribute(event, ["motionKey"]) !== undefined}<p class="wrap-break-word font-mono text-[0.68rem] opacity-65">{formatValue(getAttribute(event, ["motionKey"])!)}</p>{/if}
                    {#if getAttribute(event, ["facialKey"]) !== undefined}<p class="wrap-break-word font-mono text-[0.68rem] opacity-65">{formatValue(getAttribute(event, ["facialKey"])!)}</p>{/if}
                  </div>
                </div>
              {:else if event.category === "stage"}
                {#if getPrimaryValue(event) !== undefined}<p class="mt-1 whitespace-pre-line text-sm/5">{formatValue(getPrimaryValue(event)!)}</p>{/if}
              {:else}
                {#if event.type !== "audience"}
                  <p class="mt-1 whitespace-pre-line text-sm/5">{summary(event)}</p>
                {/if}
                {#if event.characterName}<p class="mt-0.5 text-xs opacity-60">
                    {event.characterName}
                  </p>{/if}
              {/if}
            </div>
          </div>
          {#if remaining.length > 0 || event.durationSec !== null || event.endSec !== null || event.character3dId !== null}
            <details class="mt-2 border-t border-base-content/8 pt-2 text-xs">
              <summary class="cursor-pointer font-semibold opacity-65 marker:text-primary">
                {t("virtualLiveTimelineDetails")}
              </summary>
              <dl class="mt-2 grid gap-2 sm:grid-cols-2">
                {#if event.durationSec !== null}<div>
                    <dt class="opacity-55">{t("virtualLiveTimelineDuration")}</dt>
                    <dd>
                      {t("virtualLiveTimelineDurationValue").replace(
                        "{duration}",
                        event.durationSec.toFixed(1)
                      )}
                    </dd>
                  </div>{/if}
                {#if event.endSec !== null}<div>
                    <dt class="opacity-55">{t("virtualLiveTimelineEndTime")}</dt>
                    <dd>{formatTime(event.endSec)}</dd>
                  </div>{/if}
                {#if event.character3dId !== null}<div>
                    <dt class="opacity-55">{t("virtualLiveTimelineCharacter3dId")}</dt>
                    <dd>{event.character3dId}</dd>
                  </div>{/if}
                {#each remaining as [key, value] (key)}
                  <div class="min-w-0">
                    <dt class="capitalize opacity-55">{formatKey(key)}</dt>
                    <dd class="whitespace-pre-wrap wrap-break-word">{formatValue(value)}</dd>
                  </div>
                {/each}
              </dl>
            </details>
          {/if}
        </li>
      {/each}
    </ol>
    {#if visibleLimit < filteredEvents.length}
      <button
        type="button"
        class="btn btn-outline btn-sm w-full"
        onclick={() => (visibleLimit += batchSize)}
      >
        {t("virtualLiveTimelineShowMore")}
      </button>
    {/if}
  </div>
{/if}
