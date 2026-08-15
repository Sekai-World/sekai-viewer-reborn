<script lang="ts">
  import type { CardDetailCharacter, CardDetailSkill } from "$lib/domain/card-detail";
  import {
    formatEffectValue,
    formatSkillDescription,
    getSelectedSkillEffects
  } from "$lib/skill-description";
  import Icon from "@iconify/svelte";

  let {
    skill,
    character,
    title,
    skillLevelLabel,
    durationLabel,
    effectValueLabel,
    noSkillLabel
  }: {
    skill: CardDetailSkill | null;
    character: CardDetailCharacter | null;
    title: string;
    skillLevelLabel: string;
    durationLabel: string;
    effectValueLabel: string;
    noSkillLabel: string;
  } = $props();

  let selectedLevel = $state(1);
  let lastSkillIdentity = $state("");
  const maxSkillLevel = $derived(Math.max(1, skill?.maxSkillLevel ?? 1));
  const selectedEffectDetails = $derived(getSelectedSkillEffects(skill, selectedLevel));
  const formatEffectType = (value: string | null): string =>
    value
      ?.replaceAll("_", " ")
      .split(" ")
      .filter(Boolean)
      .map((segment) => segment.slice(0, 1).toUpperCase() + segment.slice(1))
      .join(" ") ?? "--";
  const descriptionText = $derived(
    skill ? formatSkillDescription({ skill, skillLevel: selectedLevel, character }) : null
  );
  const setSelectedLevel = (value: string): void => {
    const nextValue = Number(value);
    if (!Number.isFinite(nextValue)) {
      return;
    }

    selectedLevel = Math.max(1, Math.min(maxSkillLevel, Math.trunc(nextValue)));
  };

  $effect(() => {
    const nextSkillIdentity = `${skill?.name ?? ""}:${maxSkillLevel}`;
    if (nextSkillIdentity !== lastSkillIdentity) {
      lastSkillIdentity = nextSkillIdentity;
      selectedLevel = maxSkillLevel;
      return;
    }

    if (selectedLevel > maxSkillLevel) {
      selectedLevel = maxSkillLevel;
    } else if (selectedLevel < 1) {
      selectedLevel = 1;
    }
  });
</script>

<article class="card content-card-shell shadow-sm">
  <div class="card-body gap-4 p-3 sm:p-5">
    <p
      class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60"
    >
      <Icon icon="mdi:creation-outline" class="size-4" aria-hidden="true" />
      <span>{title}</span>
    </p>

    {#if skill}
      <div class="grid gap-3 lg:grid-cols-2 lg:items-start">
        <div class="space-y-3">
          <label class="content-card-inset block rounded-xl p-3 sm:px-4">
            <span class="flex items-center justify-between gap-4 text-sm font-semibold">
              <span>{skillLevelLabel}</span>
              <span class="flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  max={maxSkillLevel}
                  value={selectedLevel}
                  class="input input-xs h-8 w-16 text-right tabular-nums"
                  aria-label={skillLevelLabel}
                  onchange={(event) => setSelectedLevel(event.currentTarget.value)}
                />
                <span class="opacity-60">/{maxSkillLevel}</span>
              </span>
            </span>
            <input
              type="range"
              min="1"
              max={maxSkillLevel}
              bind:value={selectedLevel}
              class="range range-primary range-sm mt-3"
            />
          </label>

          {#if selectedEffectDetails.length > 0}
            <div class="grid gap-2 sm:grid-cols-2">
              {#each selectedEffectDetails as item, index (`effect-${index}`)}
                <div class="content-card-inset rounded-xl p-3 sm:px-4">
                  <p class="text-sm font-semibold">{formatEffectType(item.effect.type)}</p>
                  <div class="mt-2 space-y-1 text-xs opacity-75">
                    {#if item.detail?.activateEffectDuration !== null}
                      <p>{durationLabel}: {item.detail?.activateEffectDuration}</p>
                    {/if}
                    {#if item.detail?.activateEffectValue !== null}
                      <p>
                        {effectValueLabel}: {formatEffectValue(
                          item.detail?.activateEffectValue ?? null,
                          item.detail?.activateEffectValueType ?? null
                        )}
                      </p>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <dl class="space-y-2">
          {#if skill.name || descriptionText}
            <div class="content-card-inset rounded-xl p-3 sm:px-4">
              {#if skill.name}
                <p class="text-sm font-semibold">{skill.name}</p>
              {/if}
              {#if descriptionText}
                <p class="mt-1 whitespace-pre-line text-sm opacity-75">{descriptionText}</p>
              {/if}
            </div>
          {/if}
        </dl>
      </div>
    {:else}
      <div class="alert">{noSkillLabel}</div>
    {/if}
  </div>
</article>
