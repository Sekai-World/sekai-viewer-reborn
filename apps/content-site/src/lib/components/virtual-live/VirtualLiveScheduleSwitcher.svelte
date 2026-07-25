<script lang="ts">
  import type { VirtualLiveSchedule } from "$lib/domain/virtual-live";
  import { normalizeUiLocale } from "$lib/i18n/region";
  import { toTimestampMs } from "$lib/time/date-time";

  type ScheduleEntry = {
    schedule: VirtualLiveSchedule;
    originalIndex: number;
  };

  type ScheduleGroup = {
    key: string;
    label: string;
    schedules: ScheduleEntry[];
    firstStartMs: number | null;
  };

  let {
    schedules,
    uiLocale,
    virtualLiveId,
    labelledBy,
    unavailableLabel,
    afterEventLabel
  }: {
    schedules: VirtualLiveSchedule[];
    uiLocale: string;
    virtualLiveId: string;
    labelledBy: string;
    unavailableLabel: string;
    afterEventLabel: string;
  } = $props();

  let selectedKey = $state<string | null>(null);

  const locale = $derived(normalizeUiLocale(uiLocale));
  // A locale-independent key preserves the selected calendar day when only the UI locale changes.
  const calendarKeyFormatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const dateLabelFormatter = $derived(
    new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric" })
  );
  const timeFormatter = $derived(
    new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" })
  );
  const dateTimeFormatter = $derived(
    new Intl.DateTimeFormat(locale, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  );

  const dateKey = (timestamp: number): string => calendarKeyFormatter.format(timestamp);

  const groups = $derived.by((): ScheduleGroup[] => {
    const grouped: Record<string, ScheduleGroup> = {};
    const unavailableSchedules: ScheduleEntry[] = [];

    for (const [originalIndex, schedule] of schedules.entries()) {
      const startMs = toTimestampMs(schedule.startAt);
      if (startMs === null) {
        unavailableSchedules.push({ schedule, originalIndex });
        continue;
      }

      const key = dateKey(startMs);
      const existing = grouped[key];
      if (existing) {
        existing.schedules.push({ schedule, originalIndex });
        existing.firstStartMs = Math.min(existing.firstStartMs ?? startMs, startMs);
      } else {
        grouped[key] = {
          key,
          label: dateLabelFormatter.format(startMs),
          schedules: [{ schedule, originalIndex }],
          firstStartMs: startMs
        };
      }
    }

    const result = Object.values(grouped).sort(
      (left, right) => (left.firstStartMs ?? 0) - (right.firstStartMs ?? 0)
    );
    if (unavailableSchedules.length > 0) {
      result.push({
        key: "__unavailable__",
        label: unavailableLabel,
        schedules: unavailableSchedules,
        firstStartMs: null
      });
    }

    return result.map((group) => ({
      ...group,
      schedules: group.schedules.toSorted((left, right) => {
        const leftStart = toTimestampMs(left.schedule.startAt);
        const rightStart = toTimestampMs(right.schedule.startAt);
        if (leftStart === null && rightStart === null)
          return left.originalIndex - right.originalIndex;
        if (leftStart === null) return 1;
        if (rightStart === null) return -1;
        return leftStart - rightStart || left.originalIndex - right.originalIndex;
      })
    }));
  });

  const defaultGroupKey = $derived.by((): string | null => {
    const now = Date.now();
    const active = groups.find((group) =>
      group.schedules.some(({ schedule }) => {
        const startMs = toTimestampMs(schedule.startAt);
        const endMs = toTimestampMs(schedule.endAt);
        return startMs !== null && endMs !== null && startMs <= now && now <= endMs;
      })
    );
    if (active) return active.key;

    const future = groups.find((group) =>
      group.schedules.some(({ schedule }) => {
        const startMs = toTimestampMs(schedule.startAt);
        return startMs !== null && startMs > now;
      })
    );
    const lastDatedGroup = groups.findLast((group) => group.firstStartMs !== null);
    return future?.key ?? lastDatedGroup?.key ?? groups.at(-1)?.key ?? null;
  });

  const activeKey = $derived(
    selectedKey !== null && groups.some((group) => group.key === selectedKey)
      ? selectedKey
      : defaultGroupKey
  );
  const activeGroup = $derived(groups.find((group) => group.key === activeKey) ?? null);
  const idPrefix = $derived(`virtual-live-${virtualLiveId.replaceAll(/[^a-zA-Z0-9_-]/g, "-")}`);

  const tabId = (index: number): string => `${idPrefix}-schedule-date-tab-${index}`;
  const panelId = (index: number): string => `${idPrefix}-schedule-date-panel-${index}`;

  const selectTab = (index: number, focus = false): void => {
    const group = groups[index];
    if (!group) return;
    selectedKey = group.key;
    if (focus) requestAnimationFrame(() => document.getElementById(tabId(index))?.focus());
  };

  const handleTabKeydown = (event: KeyboardEvent, index: number): void => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % groups.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + groups.length) % groups.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = groups.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    selectTab(nextIndex, true);
  };

  const formatRange = (schedule: VirtualLiveSchedule): string => {
    const startMs = toTimestampMs(schedule.startAt);
    const endMs = toTimestampMs(schedule.endAt);
    const start = startMs === null ? unavailableLabel : timeFormatter.format(startMs);
    if (endMs === null) return `${start} – ${unavailableLabel}`;

    const end =
      startMs !== null && dateKey(startMs) === dateKey(endMs)
        ? timeFormatter.format(endMs)
        : dateTimeFormatter.format(endMs);
    return `${start} – ${end}`;
  };

  const tabAccessibleLabel = (group: ScheduleGroup): string =>
    `${group.label} (${group.schedules.length})`;
</script>

<div
  class="scrollbar-thin -mx-1 flex max-w-full gap-1.5 overflow-x-auto px-1 pb-1"
  role="tablist"
  aria-labelledby={labelledBy}
  data-swipe-region-skip
>
  {#each groups as group, index (group.key)}
    <button
      id={tabId(index)}
      type="button"
      role="tab"
      aria-selected={group.key === activeKey}
      aria-controls={panelId(index)}
      aria-label={tabAccessibleLabel(group)}
      tabindex={group.key === activeKey ? 0 : -1}
      class={`btn btn-sm h-auto min-h-10 shrink-0 rounded-xl px-3 py-2 outline-offset-2 transition-colors focus-visible:outline-2 focus-visible:outline-primary ${
        group.key === activeKey
          ? "btn-primary shadow-sm"
          : "border-base-content/10 bg-base-200/55 hover:border-primary/30 hover:bg-base-200"
      }`}
      onclick={() => selectTab(index)}
      onkeydown={(event) => handleTabKeydown(event, index)}
    >
      <span>{group.label}</span>
      <span class={`badge badge-sm ${group.key === activeKey ? "badge-ghost" : "badge-outline"}`}>
        {group.schedules.length}
      </span>
    </button>
  {/each}
</div>

{#if activeGroup}
  {@const activeIndex = groups.indexOf(activeGroup)}
  <div
    id={panelId(activeIndex)}
    role="tabpanel"
    aria-labelledby={tabId(activeIndex)}
    tabindex="0"
    class="grid gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:grid-cols-2 2xl:grid-cols-3"
  >
    {#each activeGroup.schedules as entry (entry.schedule.id ?? entry.originalIndex)}
      {@const schedule = entry.schedule}
      <div
        class="content-card-inset flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl p-3"
      >
        <p class="min-w-0 wrap-break-word text-sm font-semibold tabular-nums">
          {formatRange(schedule)}
        </p>
        {#if schedule.isAfterEvent}
          <span class="badge badge-outline badge-sm shrink-0 font-semibold">{afterEventLabel}</span>
        {/if}
      </div>
    {/each}
  </div>
{/if}
