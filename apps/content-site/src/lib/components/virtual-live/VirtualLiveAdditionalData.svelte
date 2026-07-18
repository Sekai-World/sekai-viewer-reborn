<script lang="ts">
  import { getLocalCharacterThumbnailAssetURL } from "$lib/assets/characters";
  import CharacterAvatar from "$lib/components/shared/CharacterAvatar.svelte";
  import Icon from "@iconify/svelte";
  import type { SupportedRegion } from "$lib/domain/regions";
  import type {
    VirtualLiveGroupDisplay,
    VirtualLivePamphletDisplay,
    VirtualLiveScreenMvMusicVocalDisplay,
    VirtualLiveTicketDisplay
  } from "$lib/domain/virtual-live";

  let {
    group,
    screenMv,
    pamphlet,
    ticket,
    region,
    title,
    groupTitle,
    screenMvTitle,
    pamphletTitle,
    ticketTitle,
    periodLabel,
    musicFallbackLabel,
    characterLabel,
    formatDate,
    formatVocalType,
    formatTicketType
  }: {
    group: VirtualLiveGroupDisplay | null;
    screenMv: VirtualLiveScreenMvMusicVocalDisplay | null;
    pamphlet: VirtualLivePamphletDisplay | null;
    ticket: VirtualLiveTicketDisplay | null;
    region: SupportedRegion;
    title: string;
    groupTitle: string;
    screenMvTitle: string;
    pamphletTitle: string;
    ticketTitle: string;
    periodLabel: string;
    musicFallbackLabel: string;
    characterLabel: string;
    formatDate: (value: string | number | null) => string;
    formatVocalType: (value: string) => string;
    formatTicketType: (value: string) => string;
  } = $props();

  const hasText = (value: string | null | undefined): value is string =>
    typeof value === "string" && value.trim().length > 0;
  const hasGroup = $derived(
    group !== null && (hasText(group.name) || group.startAt !== null || group.endAt !== null)
  );
  const hasScreenMv = $derived(
    screenMv !== null &&
      (screenMv.musicId !== null ||
        hasText(screenMv.musicTitle) ||
        hasText(screenMv.caption) ||
        hasText(screenMv.musicVocalType) ||
        screenMv.characterIds.some((id) => Number.isInteger(id) && id > 0))
  );
  const hasPamphlet = $derived(
    pamphlet !== null && (hasText(pamphlet.name) || hasText(pamphlet.flavorText))
  );
  const hasTicket = $derived(
    ticket !== null &&
      (hasText(ticket.name) || hasText(ticket.flavorText) || hasText(ticket.virtualLiveTicketType))
  );
  const hasAdditionalData = $derived(hasGroup || hasScreenMv || hasPamphlet || hasTicket);
  const visibleCharacterIds = $derived(
    screenMv?.characterIds.filter((id) => Number.isInteger(id) && id > 0) ?? []
  );
  const getPeriod = (): string | null => {
    if (!group || (group.startAt === null && group.endAt === null)) return null;
    return periodLabel
      .replace("{start}", group.startAt !== null ? formatDate(group.startAt) : "")
      .replace("{end}", group.endAt !== null ? formatDate(group.endAt) : "");
  };
  const getMusicLabel = (): string | null => {
    if (!screenMv) return null;
    if (hasText(screenMv.musicTitle)) return screenMv.musicTitle;
    return screenMv.musicId !== null
      ? musicFallbackLabel.replace("{id}", String(screenMv.musicId))
      : null;
  };
</script>

{#if hasAdditionalData}
  <article class="card content-card-shell shadow-sm">
    <div class="card-body gap-4 p-3 sm:p-5">
      <h2
        class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60"
      >
        <Icon icon="mdi:puzzle" class="size-4 shrink-0 translate-y-[0.5px]" aria-hidden="true" />
        <span>{title}</span>
      </h2>
      <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {#if hasGroup && group}
          <section
            class="content-card-inset rounded-xl p-3"
            aria-labelledby="virtual-live-group-title"
          >
            <h3
              id="virtual-live-group-title"
              class="text-xs font-semibold uppercase tracking-[0.16em] opacity-55"
            >
              {groupTitle}
            </h3>
            {#if hasText(group.name)}<p class="mt-1.5 text-sm font-semibold">{group.name}</p>{/if}
            {#if getPeriod()}<p class="mt-1 text-xs/5 opacity-65">{getPeriod()}</p>{/if}
          </section>
        {/if}

        {#if hasScreenMv && screenMv}
          <section
            class="content-card-inset rounded-xl p-3"
            aria-labelledby="virtual-live-screen-mv-title"
          >
            <h3
              id="virtual-live-screen-mv-title"
              class="text-xs font-semibold uppercase tracking-[0.16em] opacity-55"
            >
              {screenMvTitle}
            </h3>
            {#if getMusicLabel()}
              {#if screenMv.musicId !== null}
                <a
                  href={`/music/${region}/${screenMv.musicId}`}
                  class="mt-1.5 inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-primary"
                  >{getMusicLabel()}</a
                >
              {:else}
                <p class="mt-1.5 text-sm font-semibold">{getMusicLabel()}</p>
              {/if}
            {/if}
            {#if hasText(screenMv.caption)}<p class="mt-1 whitespace-pre-line text-xs/5 opacity-70">
                {screenMv.caption}
              </p>{/if}
            <div class="mt-2 flex flex-wrap items-center gap-2">
              {#if hasText(screenMv.musicVocalType)}
                <span class="badge badge-outline badge-sm font-medium"
                  >{formatVocalType(screenMv.musicVocalType)}</span
                >
              {/if}
              {#each visibleCharacterIds as characterId (characterId)}
                {@const label = `${characterLabel} #${characterId}`}
                <a
                  href={`/character/${region}/${characterId}`}
                  class="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  aria-label={label}
                  title={label}
                >
                  <CharacterAvatar
                    src={getLocalCharacterThumbnailAssetURL(characterId)}
                    {label}
                    {characterId}
                    variant="xs"
                    decorative
                  />
                </a>
              {/each}
            </div>
          </section>
        {/if}

        {#if hasPamphlet && pamphlet}
          <section
            class="content-card-inset rounded-xl p-3"
            aria-labelledby="virtual-live-pamphlet-title"
          >
            <h3
              id="virtual-live-pamphlet-title"
              class="text-xs font-semibold uppercase tracking-[0.16em] opacity-55"
            >
              {pamphletTitle}
            </h3>
            {#if hasText(pamphlet.name)}<p class="mt-1.5 text-sm font-semibold">
                {pamphlet.name}
              </p>{/if}
            {#if hasText(pamphlet.flavorText)}<p
                class="mt-1 whitespace-pre-line text-xs/5 opacity-70"
              >
                {pamphlet.flavorText}
              </p>{/if}
          </section>
        {/if}

        {#if hasTicket && ticket}
          <section
            class="content-card-inset rounded-xl p-3"
            aria-labelledby="virtual-live-ticket-title"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h3
                id="virtual-live-ticket-title"
                class="text-xs font-semibold uppercase tracking-[0.16em] opacity-55"
              >
                {ticketTitle}
              </h3>
              {#if hasText(ticket.virtualLiveTicketType)}
                <span class="badge badge-outline badge-sm font-medium"
                  >{formatTicketType(ticket.virtualLiveTicketType)}</span
                >
              {/if}
            </div>
            {#if hasText(ticket.name)}<p class="mt-1.5 text-sm font-semibold">{ticket.name}</p>{/if}
            {#if hasText(ticket.flavorText)}<p
                class="mt-1 whitespace-pre-line text-xs/5 opacity-70"
              >
                {ticket.flavorText}
              </p>{/if}
          </section>
        {/if}
      </div>
    </div>
  </article>
{/if}
