<script lang="ts">
  import { toTimestampMs } from "$lib/date-time";
  import type { EventDetail } from "$lib/event-detail";
  import EventCountdownCard from "$lib/components/EventCountdownCard.svelte";
  import Icon from "@iconify/svelte";

  let {
    event,
    isCurrentEvent,
    uiLocale,
    title
  }: {
    event: EventDetail;
    isCurrentEvent: boolean;
    uiLocale: string;
    title: string;
  } = $props();

  const isEventEnded = (endAtValue: string | number | null): boolean => {
    const endAtMs = toTimestampMs(endAtValue);
    return endAtMs !== null && Date.now() >= endAtMs;
  };
</script>

{#if isCurrentEvent && !isEventEnded(event.endAt)}
  <article class="card content-card-shell shadow-sm">
    <div class="card-body gap-4 p-5">
      <p
        class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60"
      >
        <Icon
          icon="mdi:timer-sand"
          class="size-4 shrink-0 translate-y-[0.5px]"
          aria-hidden="true"
        />
        <span>{title}</span>
      </p>
      <EventCountdownCard
        startAt={event.startAt}
        endAt={event.endAt}
        {uiLocale}
        forceShowSeconds={true}
        showProgress={false}
      />
    </div>
  </article>
{/if}
