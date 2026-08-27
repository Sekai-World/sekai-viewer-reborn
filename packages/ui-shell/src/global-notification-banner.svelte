<script lang="ts">
  import { onMount } from "svelte";
  import { SvelteSet } from "svelte/reactivity";
  import type {
    GlobalNotice,
    GlobalNotificationBannerProps,
    GlobalNoticeSeverity
  } from "./global-notification-banner.types";

  const DEFAULT_STORAGE_KEY = "platform-ui-shell:dismissed-notifications";
  const defaultSeverityLabels: Record<GlobalNoticeSeverity, string> = {
    info: "Info",
    success: "Success",
    warning: "Warning",
    error: "Error"
  };

  let {
    notices = [],
    storageKey = DEFAULT_STORAGE_KEY,
    announcementsLabel = "System announcements",
    dismissLabel = "Dismiss announcement",
    severityLabels = {}
  }: GlobalNotificationBannerProps = $props();

  const dismissedNoticeKeys = new SvelteSet<string>();
  let storageReady = $state(false);
  const visibleNotices = $derived(
    storageReady
      ? notices.filter((notice) => !dismissedNoticeKeys.has(getNoticeStorageKey(notice)))
      : []
  );

  function getNoticeStorageKey(notice: GlobalNotice): string {
    return JSON.stringify([notice.id, String(notice.version)]);
  }

  function parseDismissedNoticeKeys(value: string | null): SvelteSet<string> {
    if (!value) {
      return new SvelteSet();
    }

    try {
      const parsed: unknown = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        return new SvelteSet();
      }

      return new SvelteSet(parsed.filter((entry): entry is string => typeof entry === "string"));
    } catch {
      return new SvelteSet();
    }
  }

  function readDismissedNoticeKeys(): SvelteSet<string> {
    try {
      return parseDismissedNoticeKeys(localStorage.getItem(storageKey));
    } catch {
      return new SvelteSet();
    }
  }

  function replaceDismissedNoticeKeys(nextKeys: SvelteSet<string>): void {
    dismissedNoticeKeys.clear();
    for (const key of nextKeys) {
      dismissedNoticeKeys.add(key);
    }
  }

  function persistDismissedNoticeKeys(nextKeys: SvelteSet<string>): void {
    try {
      localStorage.setItem(storageKey, JSON.stringify([...nextKeys]));
    } catch {
      // Storage can be unavailable in privacy-restricted browsing contexts.
    }
  }

  function dismissNotice(notice: GlobalNotice): void {
    dismissedNoticeKeys.add(getNoticeStorageKey(notice));
    persistDismissedNoticeKeys(dismissedNoticeKeys);
  }

  function getSeverityLabel(severity: GlobalNoticeSeverity): string {
    return severityLabels[severity] ?? defaultSeverityLabels[severity];
  }

  function getNoticeId(index: number, notice: GlobalNotice, suffix: "title" | "message"): string {
    return `global-notice-${index}-${notice.id.replace(/[^a-zA-Z0-9_-]/g, "-")}-${suffix}`;
  }

  onMount(() => {
    replaceDismissedNoticeKeys(readDismissedNoticeKeys());
    storageReady = true;

    const handleStorage = (event: StorageEvent): void => {
      if (event.key === storageKey) {
        replaceDismissedNoticeKeys(parseDismissedNoticeKeys(event.newValue));
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  });
</script>

{#if visibleNotices.length > 0}
  <div class="global-notifications" role="region" aria-label={announcementsLabel}>
    {#each visibleNotices as notice, index (getNoticeStorageKey(notice))}
      {@const titleId = getNoticeId(index, notice, "title")}
      {@const messageId = getNoticeId(index, notice, "message")}
      <article
        class={`global-notice global-notice-${notice.severity}`}
        role={notice.severity === "error" ? "alert" : "status"}
        aria-live={notice.severity === "error" ? "assertive" : "polite"}
        aria-atomic="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
      >
        <span class="global-notice-marker" aria-hidden="true"></span>
        <div class="global-notice-content">
          <div class="global-notice-heading">
            <span class="global-notice-severity">{getSeverityLabel(notice.severity)}</span>
            <h2 id={titleId}>{notice.title}</h2>
          </div>
          <p id={messageId}>{notice.message}</p>
          {#if notice.action}
            <a
              class="global-notice-action"
              href={notice.action.href}
              target={notice.action.target}
              rel={notice.action.target === "_blank"
                ? (notice.action.rel ?? "noreferrer")
                : notice.action.rel}
            >
              <span>{notice.action.label}</span>
            </a>
          {/if}
        </div>
        {#if notice.dismissible !== false}
          <button
            class="global-notice-dismiss"
            type="button"
            aria-label={`${dismissLabel}: ${notice.title}`}
            title={dismissLabel}
            onclick={() => dismissNotice(notice)}
          >
            <span class="global-notice-close-mark" aria-hidden="true"></span>
          </button>
        {/if}
      </article>
    {/each}
  </div>
{/if}

<style>
  .global-notifications {
    position: sticky;
    z-index: 60;
    top: 0;
    display: grid;
    width: 100%;
    max-width: 96rem;
    gap: 0.5rem;
    margin: 0 auto;
    padding: 0.75rem 0.75rem 0;
    pointer-events: none;
  }

  .global-notice {
    --notice-accent: var(--color-info);

    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 0.75rem;
    align-items: start;
    min-width: 0;
    padding: 0.875rem;
    border: 1px solid color-mix(in oklab, var(--notice-accent) 30%, var(--color-base-content));
    border-inline-start: 4px solid var(--notice-accent);
    border-radius: 1rem;
    background: color-mix(in oklab, var(--color-base-100) 94%, var(--notice-accent) 6%);
    color: var(--color-base-content);
    box-shadow: 0 8px 24px color-mix(in oklab, var(--color-base-content) 10%, transparent);
    pointer-events: auto;
  }

  .global-notice-info {
    --notice-accent: var(--color-info);
  }

  .global-notice-success {
    --notice-accent: var(--color-success);
  }

  .global-notice-warning {
    --notice-accent: var(--color-warning);
  }

  .global-notice-error {
    --notice-accent: var(--color-error);
  }

  .global-notice-marker {
    display: block;
    width: 0.625rem;
    height: 0.625rem;
    margin-top: 0.35rem;
    border: 2px solid var(--notice-accent);
    border-radius: 9999px;
    box-shadow: 0 0 0 0.25rem color-mix(in oklab, var(--notice-accent) 15%, transparent);
  }

  .global-notice-content {
    min-width: 0;
  }

  .global-notice-heading {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.5rem;
  }

  .global-notice-heading h2 {
    min-width: 0;
    margin: 0;
    font-size: 1rem;
    font-weight: 800;
    line-height: 1.35;
    letter-spacing: -0.01em;
    overflow-wrap: anywhere;
  }

  .global-notice-severity {
    flex: none;
    color: color-mix(in oklab, var(--notice-accent) 82%, var(--color-base-content));
    font-size: 0.68rem;
    font-weight: 850;
    letter-spacing: 0.1em;
    line-height: 1.4;
    text-transform: uppercase;
  }

  .global-notice-content p {
    max-width: 70ch;
    margin: 0.25rem 0 0;
    color: color-mix(in oklab, var(--color-base-content) 78%, transparent);
    font-size: 0.9rem;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .global-notice-action {
    display: inline-flex;
    min-height: 2.75rem;
    align-items: center;
    gap: 0.4rem;
    margin-top: 0.625rem;
    padding: 0.45rem 0.75rem;
    border: 1px solid color-mix(in oklab, var(--notice-accent) 45%, var(--color-base-content));
    border-radius: 9999px;
    color: color-mix(in oklab, var(--notice-accent) 88%, var(--color-base-content));
    font-size: 0.875rem;
    font-weight: 750;
    text-decoration: none;
    transition:
      background-color 180ms ease-out,
      color 180ms ease-out,
      transform 180ms ease-out;
  }

  .global-notice-action:hover {
    background: var(--notice-accent);
    color: var(--color-base-100);
    transform: translateY(-1px);
  }

  .global-notice-dismiss {
    display: inline-grid;
    width: 2.75rem;
    height: 2.75rem;
    flex: none;
    place-items: center;
    margin: -0.25rem -0.25rem 0 0;
    border: 0;
    border-radius: 9999px;
    background: transparent;
    color: color-mix(in oklab, var(--color-base-content) 65%, transparent);
    font-size: 1.5rem;
    line-height: 1;
    cursor: pointer;
    transition:
      background-color 180ms ease-out,
      color 180ms ease-out;
  }

  .global-notice-dismiss:hover {
    background: color-mix(in oklab, var(--color-base-content) 10%, transparent);
    color: var(--color-base-content);
  }

  .global-notice-close-mark {
    position: relative;
    display: block;
    width: 1rem;
    height: 1rem;
  }

  .global-notice-close-mark::before,
  .global-notice-close-mark::after {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 1.1rem;
    height: 2px;
    border-radius: 9999px;
    background: currentColor;
    content: "";
  }

  .global-notice-close-mark::before {
    transform: translate(-50%, -50%) rotate(45deg);
  }

  .global-notice-close-mark::after {
    transform: translate(-50%, -50%) rotate(-45deg);
  }

  .global-notice-action:focus-visible,
  .global-notice-dismiss:focus-visible {
    outline: 3px solid var(--color-primary);
    outline-offset: 3px;
  }

  @media (min-width: 640px) {
    .global-notifications {
      padding-inline: 1.5rem;
    }

    .global-notice {
      padding: 1rem 1.125rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .global-notice-action,
    .global-notice-dismiss {
      transition: none;
    }

    .global-notice-action:hover {
      transform: none;
    }
  }

  :global([data-low-motion]) .global-notice-action,
  :global([data-low-motion]) .global-notice-dismiss {
    transition: none;
  }

  :global([data-low-motion]) .global-notice-action:hover {
    transform: none;
  }
</style>
