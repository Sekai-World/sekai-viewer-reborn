<script lang="ts">
  import { toTimestampMs } from "$lib/time/date-time";
  import type { EventDetail } from "$lib/domain/event-detail";
  import EventCountdownCard from "$lib/components/event/EventCountdownCard.svelte";
  import Icon from "@iconify/svelte";
  import type { I18nMessages } from "@platform/i18n-runtime";

  let {
    event,
    isCurrentEvent,
    uiLocale,
    messages,
    title
  }: {
    event: EventDetail;
    isCurrentEvent: boolean;
    uiLocale: string;
    messages: I18nMessages;
    title: string;
  } = $props();

  const isEventEnded = (endAtValue: string | number | null): boolean => {
    const endAtMs = toTimestampMs(endAtValue);
    return endAtMs !== null && Date.now() >= endAtMs;
  };
</script>

{#if isCurrentEvent && !isEventEnded(event.endAt)}
  <article
    class="card content-card-shell border-primary/20 shadow-[0_8px_24px_color-mix(in_oklab,var(--color-primary)_9%,transparent)]"
  >
    <div class="card-body gap-4 p-3 sm:p-5">
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
      <div class="content-card-inset border-primary/15 bg-(--archive-surface-raised) p-3 sm:p-4">
        <EventCountdownCard
          startAt={event.startAt}
          endAt={event.endAt}
          {uiLocale}
          {messages}
          forceShowSeconds={true}
          showProgress={false}
        />
      </div>
    </div>
  </article>
{/if}
