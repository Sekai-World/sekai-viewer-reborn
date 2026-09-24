<script lang="ts">
  type Projection = Readonly<{ startScore: number; finalScore: number; capturedAt: number }>;
  let {
    user,
    target,
    deadlineAt,
    locale,
    userLabel,
    targetLabel,
    ariaLabel
  }: {
    user: Projection;
    target: Projection;
    deadlineAt: number;
    locale: string;
    userLabel: string;
    targetLabel: string;
    ariaLabel: string;
  } = $props();
  const width = 640,
    height = 260,
    padding = { top: 20, right: 24, bottom: 42, left: 58 };
  const formatScore = (value: number) =>
    new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value);
  const formatTime = (value: number) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(value);
  const startAt = $derived(Math.min(user.capturedAt, target.capturedAt));
  const values = $derived([user.startScore, user.finalScore, target.startScore, target.finalScore]);
  const minScore = $derived(Math.max(0, Math.min(...values) * 0.96));
  const maxScore = $derived(Math.max(...values) * 1.04 || 1);
  const x = (time: number) =>
    padding.left +
    ((time - startAt) / Math.max(1, deadlineAt - startAt)) * (width - padding.left - padding.right);
  const y = (score: number) =>
    height -
    padding.bottom -
    ((score - minScore) / Math.max(1, maxScore - minScore)) *
      (height - padding.top - padding.bottom);
  const path = (projection: Projection) =>
    `M ${x(projection.capturedAt)} ${y(projection.startScore)} L ${x(deadlineAt)} ${y(projection.finalScore)}`;
</script>

<div class="goal-projection-chart" role="img" aria-label={ariaLabel}>
  <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
    <line
      class="goal-axis"
      x1={padding.left}
      y1={height - padding.bottom}
      x2={width - padding.right}
      y2={height - padding.bottom}
    />
    <line
      class="goal-axis"
      x1={padding.left}
      y1={padding.top}
      x2={padding.left}
      y2={height - padding.bottom}
    />
    <path class="goal-line goal-line-user" d={path(user)} /><path
      class="goal-line goal-line-target"
      d={path(target)}
    />
    <circle
      class="goal-dot goal-dot-user"
      cx={x(deadlineAt)}
      cy={y(user.finalScore)}
      r="5"
    /><circle class="goal-dot goal-dot-target" cx={x(deadlineAt)} cy={y(target.finalScore)} r="5" />
    <text class="goal-axis-label" x={padding.left} y={height - 14}>{formatTime(startAt)}</text>
    <text class="goal-axis-label" text-anchor="end" x={width - padding.right} y={height - 14}
      >{formatTime(deadlineAt)}</text
    >
    <text class="goal-axis-label" x={padding.left - 8} y={padding.top + 4} text-anchor="end"
      >{formatScore(maxScore)}</text
    >
    <text
      class="goal-axis-label"
      x={padding.left - 8}
      y={height - padding.bottom + 4}
      text-anchor="end">{formatScore(minScore)}</text
    >
  </svg>
  <div class="goal-projection-legend">
    <span><i class="goal-legend-dot goal-legend-user"></i>{userLabel}</span><span
      ><i class="goal-legend-dot goal-legend-target"></i>{targetLabel}</span
    >
  </div>
</div>

<style>
  .goal-projection-chart {
    width: 100%;
    color: color-mix(in srgb, var(--color-base-content) 70%, transparent);
  }
  svg {
    display: block;
    width: 100%;
    height: auto;
    min-height: 15rem;
  }
  .goal-axis {
    stroke: color-mix(in srgb, var(--color-base-content) 22%, transparent);
    stroke-width: 1;
  }
  .goal-axis-label {
    fill: var(--archive-text-muted);
    font-size: 11px;
  }
  .goal-line {
    fill: none;
    stroke-width: 3;
    stroke-linecap: round;
  }
  .goal-line-user {
    stroke: var(--color-primary);
  }
  .goal-line-target {
    stroke: var(--color-secondary);
    stroke-dasharray: 7 5;
  }
  .goal-dot {
    stroke: var(--color-base-100);
    stroke-width: 2;
  }
  .goal-dot-user {
    fill: var(--color-primary);
  }
  .goal-dot-target {
    fill: var(--color-secondary);
  }
  .goal-projection-legend {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 1rem;
    font-size: 0.8rem;
  }
  .goal-projection-legend span {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }
  .goal-legend-dot {
    width: 0.65rem;
    height: 0.65rem;
    border-radius: 9999px;
    display: inline-block;
  }
  .goal-legend-user {
    background: var(--color-primary);
  }
  .goal-legend-target {
    background: var(--color-secondary);
  }
</style>
