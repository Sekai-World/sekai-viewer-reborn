<script lang="ts">
  import { resolve } from "$app/paths";
  import { getEventBannerAssetURL } from "$lib/assets/index";
  import type { CardRelatedEvent } from "$lib/domain/card-detail";
  import { getEventTypeDisplay } from "$lib/domain/event";
  import type { SupportedRegion } from "$lib/domain/regions";
  import EventAssetImage from "$lib/components/shared/EventAssetImage.svelte";
  import { formatDisplayDateTime, toTimestampMs } from "$lib/time/date-time";
  import Icon from "@iconify/svelte";

  let {
    events,
    region,
    uiLocale,
    title,
    emptyLabel,
    bonusLabel,
    storyLabel
  }: {
    events: CardRelatedEvent[];
    region: SupportedRegion;
    uiLocale: string;
    title: string;
    emptyLabel: string;
    bonusLabel: string;
    storyLabel: string;
  } = $props();

  const formatEventDateTime = (value: string | number | null): string => {
    const timestampMs = toTimestampMs(value);
    return formatDisplayDateTime(timestampMs ?? value, uiLocale);
  };
  const getEventTimeRange = (event: CardRelatedEvent): string => {
    const endAt = event.aggregateAt ?? event.closedAt;
    if (event.startAt === null && endAt === null) {
      return "--";
    }

    if (event.startAt === null || endAt === null) {
      return formatEventDateTime(event.startAt ?? endAt);
    }

    return `${formatEventDateTime(event.startAt)} - ${formatEventDateTime(endAt)}`;
  };
  const formatBonusRate = (value: number): string => `${value.toLocaleString(uiLocale || undefined)}%`;
  const getBonusRateRangeLabel = (event: CardRelatedEvent): string | null => {
    if (event.finalBonusRateMin !== null && event.finalBonusRateMax !== null) {
      const minLabel = formatBonusRate(event.finalBonusRateMin);
      const maxLabel = formatBonusRate(event.finalBonusRateMax);
      return event.finalBonusRateMin === event.finalBonusRateMax
        ? minLabel
        : `${minLabel}-${maxLabel}`;
    }

    return event.bonusRate !== null && event.bonusRate > 0 ? formatBonusRate(event.bonusRate) : null;
  };
</script>

<article class="card content-card-shell shadow-sm">
  <div class="card-body gap-4 p-5">
    <p class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60">
      <Icon icon="mdi:calendar-star-outline" class="size-4" aria-hidden="true" />
      <span>{title}</span>
    </p>

    {#if events.length > 0}
      <div class="grid gap-3">
        {#each events as event (event.id)}
          <a
            href={resolve("/event/[region]/[id]", { region, id: event.id })}
            class="content-card-inset group grid gap-3 overflow-hidden rounded-xl p-3 transition-[border-color,background-color,transform] duration-180 ease-out hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <div class="relative aspect-5/2 overflow-hidden rounded-xl bg-base-200/70 lg:aspect-3/1">
              {#if event.assetBundleName}
                <EventAssetImage
                  src={getEventBannerAssetURL(event.assetBundleName, region)}
                  alt={event.title}
                  imageClass="h-full w-full object-contain transition-[filter] duration-180 ease-out group-hover:brightness-105"
                  buttonClass="block h-full w-full overflow-hidden"
                  loadMode="visible"
                />
              {:else}
                <div class="flex size-full items-center justify-center px-4 text-center text-sm font-medium opacity-70">
                  {event.title}
                </div>
              {/if}

              <div class="absolute left-2 top-2">
                <span class="badge border-none bg-base-100/94 text-xs font-semibold text-base-content shadow-sm">
                  #{event.id}
                </span>
              </div>

              {#if getEventTypeDisplay(event.eventType, uiLocale)}
                <div class="absolute right-2 top-2">
                  <span class="badge border-none bg-base-100/94 text-xs font-semibold text-base-content shadow-sm">
                    {getEventTypeDisplay(event.eventType, uiLocale)}
                  </span>
                </div>
              {/if}
            </div>

            <div class="min-w-0">
              <h3 class="line-clamp-2 text-sm/snug font-semibold">{event.title}</h3>
              <div class="mt-2 flex flex-wrap items-center gap-2 text-xs opacity-70">
                <span>{getEventTimeRange(event)}</span>
                {#if getBonusRateRangeLabel(event)}
                  <span class="badge badge-outline border-primary/25 bg-primary/10 text-xs font-semibold text-primary">
                    {bonusLabel} {getBonusRateRangeLabel(event)}
                  </span>
                {/if}
                {#if event.isDisplayCardStory}
                  <span class="badge badge-outline border-secondary/25 bg-secondary/10 text-xs font-semibold text-secondary">
                    {storyLabel}
                  </span>
                {/if}
              </div>
            </div>
          </a>
        {/each}
      </div>
    {:else}
      <div class="alert">{emptyLabel}</div>
    {/if}
  </div>
</article>
