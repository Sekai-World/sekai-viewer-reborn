<script lang="ts">
  import { LineChart } from "layerchart";
  import type { ChartState } from "layerchart";
  import { findSnappedNameChange, findTrackerNameChanges } from "$lib/tracker-name-changes";

  type RankingHistoryPoint = Readonly<{
    rank: number;
    userId: string | null | undefined;
    userName: string | null | undefined;
    score: number;
    timestamp: string | null;
  }>;
  type ChartPoint = {
    rank: number;
    date: Date;
    score: number;
    sourceIndex: number;
    timestamp: string;
    userId: string | null | undefined;
    userName: string | null | undefined;
  };

  let {
    points,
    locale,
    scoreLabel,
    timeLabel,
    ariaLabel,
    nameChangeLabel,
    nameChangeLegend,
    rank,
    activePoint = $bindable(null)
  }: {
    points: readonly RankingHistoryPoint[];
    locale: string;
    scoreLabel: string;
    timeLabel: string;
    ariaLabel: string;
    nameChangeLabel: string;
    nameChangeLegend: string;
    rank: number;
    activePoint?: RankingHistoryPoint | null;
  } = $props();

  let chartContext = $state<ChartState<ChartPoint> | undefined>();
  const selectedPoint = $derived(activePoint);

  const captureHoveredPoint = (event: PointerEvent): void => {
    queueMicrotask(() => {
      const context = chartContext;
      const hovered = context?.tooltip.data;
      if (!hovered || typeof hovered !== "object" || !("score" in hovered) || !("date" in hovered)) return;
      const point = hovered as ChartPoint;
      if (!(point.date instanceof Date) || !Number.isFinite(point.date.getTime())) return;
      if (context) {
        try {
          const range = context.xScale.range();
          const domain = context.xScale.domain();
          const pxPerMs = (range[1] - range[0]) / (Number(domain[1]) - Number(domain[0]));
          const thresholdMs = 14 / pxPerMs;
          if (Number.isFinite(pxPerMs) && pxPerMs > 0 && Number.isFinite(thresholdMs)) {
            const snappedMarker = findSnappedNameChange({ hoveredDate: point.date, markers: markerPoints, thresholdMs });
            if (snappedMarker) {
              context.tooltip.show(event, snappedMarker.point);
              activateMarker(snappedMarker.point);
              return;
            }
          }
        } catch {
          // Keep LayerChart's normal hover behavior if its scale is not ready.
        }
      }
      activePoint = {
        score: point.score,
        timestamp: point.timestamp,
        rank,
        userId: point.userId,
        userName: point.userName
      };
    });
  };

  const validPoints = $derived(
    points
      .map((point, sourceIndex) => ({
        date: point.timestamp ? new Date(point.timestamp) : null,
        rank: point.rank,
        score: point.score,
        sourceIndex,
        timestamp: point.timestamp,
        userId: point.userId,
        userName: point.userName
      }))
      .filter(
        (point): point is ChartPoint =>
          point.date !== null && !Number.isNaN(point.date.getTime()) && Number.isFinite(point.score)
      )
      .sort((a, b) => a.date.getTime() - b.date.getTime() || a.sourceIndex - b.sourceIndex)
  );
  const dates = $derived(validPoints.map((point) => point.date));
  const scores = $derived(validPoints.map((point) => point.score));
  const xDomain = $derived(
    dates.length > 1
      ? [dates[0]!, dates.at(-1)!]
      : dates.length === 1
        ? [new Date(dates[0]!.getTime() - 3_600_000), new Date(dates[0]!.getTime() + 3_600_000)]
        : undefined
  );
  const scoreExtent = $derived(
    scores.length
      ? [Math.max(0, Math.min(...scores) - Math.max(1, (Math.max(...scores) - Math.min(...scores)) * 0.12)), Math.max(...scores) + Math.max(1, (Math.max(...scores) - Math.min(...scores)) * 0.12)]
      : undefined
  );
  const timeFormatter = $derived(
    new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" })
  );
  const scoreFormatter = $derived(new Intl.NumberFormat(locale));
  const axisScoreFormatter = $derived(
    new Intl.NumberFormat(locale, {
      notation: "compact",
      compactDisplay: "short",
      maximumFractionDigits: 1
    })
  );
  const nameChanges = $derived(
    findTrackerNameChanges(points, rank).map((change) => ({
      ...change,
      time: new Date(change.timestamp)
    }))
  );
  const markerPoints = $derived(
    nameChanges
      .map((change) => {
        const point = validPoints
          .filter((candidate) => candidate.date.getTime() <= change.time.getTime())
          .at(-1);
        return point ? { change, point } : null;
      })
      .filter((marker): marker is NonNullable<typeof marker> => marker !== null)
  );
  const activateMarker = (point: ChartPoint): void => {
    activePoint = {
      score: point.score,
      timestamp: point.timestamp,
      rank,
      userId: point.userId,
      userName: point.userName
    };
  };
  const handleMarkerKeydown = (event: KeyboardEvent, point: ChartPoint): void => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    activateMarker(point);
  };
</script>

<div class="history-chart" role="img" aria-label={ariaLabel} onpointermove={captureHoveredPoint}>
  <span class="sr-only">{scoreLabel} · {timeLabel}{selectedPoint ? ` · ${selectedPoint.score}` : ""}</span>
  <div class="history-chart-plot">
    {#if validPoints.length === 1}
      <div class="history-chart-single-point">
        <span class="history-chart-point" aria-hidden="true"></span>
        <strong>{scoreFormatter.format(validPoints[0]!.score)}</strong>
        {#if validPoints[0]?.timestamp}
          <span>{timeFormatter.format(validPoints[0]!.date!)}</span>
        {/if}
      </div>
    {:else if validPoints.length > 1}
      <LineChart
        bind:context={chartContext}
        data={validPoints}
        x="date"
        y="score"
        {xDomain}
        yDomain={scoreExtent}
        xNice
        yNice
        padding={{ top: 18, right: 18, bottom: 36, left: 46 }}
        props={{
          yAxis: {
            format: (value: number) => axisScoreFormatter.format(value),
            ticks: 4,
            tickLabelProps: { fontSize: 11 }
          },
          spline: {
            stroke: "var(--color-primary)",
            strokeWidth: 3,
            "stroke-linecap": "round",
            "stroke-linejoin": "round"
          }
        }}
        tooltipContext={{ mode: "bisect-x" }}
        highlight={{
          axis: "x",
          lines: { stroke: "var(--color-primary)", dashArray: "4 4", opacity: 0.55 },
          points: { r: 5, fill: "var(--color-primary)", stroke: "var(--color-base-100)", strokeWidth: 2 }
        }}
      >
        {#snippet aboveMarks({ context })}
          {#each markerPoints as marker (marker.change.timestamp)}
            {@const cx = context.xGet(marker.point)}
            {@const cy = context.yGet(marker.point)}
            {@const markerLabel = nameChangeLabel.replace("{previousName}", marker.change.previousName).replace("{nextName}", marker.change.nextName).replace("{time}", timeFormatter.format(marker.change.time))}
            <g class="history-chart-name-change" tabindex="0" role="button" aria-label={markerLabel} onclick={() => activateMarker(marker.point)} onkeydown={(event) => handleMarkerKeydown(event, marker.point)}>
              <title>{`${marker.change.previousName} → ${marker.change.nextName} · ${timeFormatter.format(marker.change.time)}`}</title>
              <path d={`M ${cx} ${cy - 7} L ${cx + 7} ${cy} L ${cx} ${cy + 7} L ${cx - 7} ${cy} Z`} />
            </g>
          {/each}
        {/snippet}
      </LineChart>
    {:else}
      <p class="history-chart-empty">{ariaLabel}</p>
    {/if}
  </div>
  <div class="history-chart-legend" aria-label={nameChangeLegend}>
    <span class="history-chart-legend-diamond" aria-hidden="true"></span>
    <span>{nameChangeLegend}</span>
  </div>
</div>

<style>
  .history-chart {
    width: 100%;
    color: color-mix(in srgb, var(--color-base-content) 70%, transparent);
  }

  .history-chart-plot {
    position: relative;
    width: 100%;
    height: clamp(15rem, 35vw, 22rem);
    min-height: 18rem;
  }

  .history-chart :global(.chart-container) {
    width: 100%;
    height: 100%;
    min-height: 0;
  }

  .history-chart-single-point {
    display: grid;
    height: 100%;
    place-content: center;
    justify-items: center;
    gap: 0.45rem;
    text-align: center;
  }

  .history-chart-single-point strong {
    color: var(--color-base-content);
    font-size: 1.5rem;
    font-variant-numeric: tabular-nums;
  }

  .history-chart-single-point span:last-child {
    font-size: 0.78rem;
  }

  .history-chart-point {
    width: 0.75rem;
    height: 0.75rem;
    border: 3px solid var(--color-base-100);
    border-radius: 9999px;
    background: var(--color-primary);
    box-shadow: 0 0 0 0.2rem color-mix(in srgb, var(--color-primary) 20%, transparent);
  }

  .history-chart-empty {
    display: grid;
    height: 100%;
    place-items: center;
    color: color-mix(in srgb, var(--color-base-content) 58%, transparent);
  }

  .history-chart-legend {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.45rem;
    width: 100%;
    margin-top: 0.5rem;
    padding: 0.25rem 0.5rem;
    border: 1px solid color-mix(in srgb, var(--color-base-content) 14%, transparent);
    border-radius: 0.5rem;
    background: color-mix(in srgb, var(--color-base-100) 88%, transparent);
    color: color-mix(in srgb, var(--color-base-content) 72%, transparent);
    font-size: 0.72rem;
    line-height: 1.2;
  }

  .history-chart-legend-diamond {
    width: 0.55rem;
    height: 0.55rem;
    flex: 0 0 auto;
    transform: rotate(45deg);
    border: 1px solid var(--color-base-100);
    background: var(--color-secondary);
  }

  .history-chart-name-change {
    cursor: pointer;
    outline: none;
    pointer-events: visiblePainted;
  }

  .history-chart-name-change path {
    fill: var(--color-secondary);
    stroke: var(--color-base-100);
    stroke-width: 1.5;
    transition: fill 150ms ease;
  }

  .history-chart-name-change:hover path,
  .history-chart-name-change:focus-visible path {
    fill: var(--color-accent);
  }

  .history-chart-name-change:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .history-chart-name-change path {
      transition: none;
    }
  }

  @media (max-width: 47.999rem) {
    .history-chart-plot,
    .history-chart-plot :global(.chart-container) {
      min-height: 15rem;
    }
  }
</style>
