<script lang="ts">
  import { LineChart } from "layerchart";
  import type { ChartState } from "layerchart";

  type RankingHistoryPoint = Readonly<{
    userId: string | null | undefined;
    userName: string | null | undefined;
    score: number;
    timestamp: string | null;
  }>;
  type ChartPoint = {
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
    activePoint = $bindable(null)
  }: {
    points: readonly RankingHistoryPoint[];
    locale: string;
    scoreLabel: string;
    timeLabel: string;
    ariaLabel: string;
    activePoint?: RankingHistoryPoint | null;
  } = $props();

  let chartContext = $state<ChartState<ChartPoint> | undefined>();
  const selectedPoint = $derived(activePoint);

  const captureHoveredPoint = (): void => {
    queueMicrotask(() => {
      const hovered = chartContext?.tooltip.data;
      if (!hovered || typeof hovered !== "object" || !("score" in hovered) || !("date" in hovered)) return;
      const point = hovered as ChartPoint;
      activePoint = {
        score: point.score,
        timestamp: point.timestamp,
        userId: point.userId,
        userName: point.userName
      };
    });
  };

  const validPoints = $derived(
    points
      .map((point, sourceIndex) => ({
        date: point.timestamp ? new Date(point.timestamp) : null,
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
</script>

<div class="history-chart" role="img" aria-label={ariaLabel} onpointermove={captureHoveredPoint}>
  <span class="sr-only">{scoreLabel} · {timeLabel}{selectedPoint ? ` · ${selectedPoint.score}` : ""}</span>
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
      padding={{ top: 18, right: 18, bottom: 36, left: 62 }}
      tooltipContext={{ mode: "bisect-x" }}
      highlight={{
        axis: "x",
        lines: { stroke: "var(--color-primary)", dashArray: "4 4", opacity: 0.55 },
        points: { r: 5, fill: "var(--color-primary)", stroke: "var(--color-base-100)", strokeWidth: 2 }
      }}
      props={{
        spline: {
          stroke: "var(--color-primary)",
          strokeWidth: 3,
          "stroke-linecap": "round",
          "stroke-linejoin": "round"
        }
      }}
    />
  {:else}
    <p class="history-chart-empty">{ariaLabel}</p>
  {/if}
</div>

<style>
  .history-chart {
    width: 100%;
    height: clamp(15rem, 35vw, 22rem);
    min-height: 18rem;
    color: color-mix(in srgb, var(--color-base-content) 70%, transparent);
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

  @media (max-width: 47.999rem) {
    .history-chart,
    .history-chart :global(.chart-container) {
      min-height: 15rem;
    }
  }
</style>
