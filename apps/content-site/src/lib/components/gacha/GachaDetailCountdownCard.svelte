<script lang="ts">
  import { toTimestampMs } from "$lib/time/date-time";
  import type { GachaDetail } from "$lib/domain/gacha-detail";
  import EventCountdownCard from "$lib/components/event/EventCountdownCard.svelte";
  import Icon from "@iconify/svelte";

  let {
    gacha,
    uiLocale,
    title
  }: {
    gacha: GachaDetail;
    uiLocale: string;
    title: string;
  } = $props();

  const isGachaEnded = (endAtValue: string | number | null): boolean => {
    const endAtMs = toTimestampMs(endAtValue);
    return endAtMs !== null && Date.now() >= endAtMs;
  };
</script>

{#if !isGachaEnded(gacha.endAt)}
  <article class="card content-card-shell shadow-sm">
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
      <EventCountdownCard
        startAt={gacha.startAt}
        endAt={gacha.endAt}
        {uiLocale}
        forceShowSeconds={true}
        showProgress={false}
      />
    </div>
  </article>
{/if}
