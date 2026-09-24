<script lang="ts">
  import Icon from "@iconify/svelte";
  import { onMount } from "svelte";
  import { closeIcon, openInNewIcon } from "./icons";
  import { SvelteSet } from "svelte/reactivity";
  import type {
    GlobalNotice,
    GlobalNoticeAction,
    GlobalNotificationBannerProps
  } from "./global-notification-banner.types";

  const DEFAULT_STORAGE_KEY = "platform-ui-shell:dismissed-notifications";
  let {
    notices = [],
    storageKey = DEFAULT_STORAGE_KEY,
    announcementsLabel = "System announcements",
    dismissLabel = "Dismiss announcement",
    externalLinkLabel = ""
  }: GlobalNotificationBannerProps = $props();

  // Static class map so Tailwind can see every daisyUI severity variant.
  const severityClasses: Record<GlobalNotice["severity"], { alert: string; status: string }> = {
    info: { alert: "alert-info", status: "status-info" },
    success: { alert: "alert-success", status: "status-success" },
    warning: { alert: "alert-warning", status: "status-warning" },
    error: { alert: "alert-error", status: "status-error" }
  };

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

  function getActionAriaLabel(
    label: string,
    target?: GlobalNoticeAction["target"]
  ): string | undefined {
    if (target !== "_blank" || !externalLinkLabel) {
      return undefined;
    }

    return `${label} (${externalLinkLabel})`;
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
  <div
    class="global-notifications pointer-events-none sticky top-0 z-60 mx-auto grid w-full max-w-384 gap-2 p-3 sm:px-6"
    role="region"
    aria-label={announcementsLabel}
  >
    {#each visibleNotices as notice, index (getNoticeStorageKey(notice))}
      {@const titleId = getNoticeId(index, notice, "title")}
      {@const messageId = getNoticeId(index, notice, "message")}
      <article
        class={`alert alert-soft ${severityClasses[notice.severity].alert} global-notice global-notice-${notice.severity} pointer-events-auto grid-flow-row grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 lg:grid-cols-[auto_minmax(0,1fr)_auto_auto]`}
        role={notice.severity === "error" ? "alert" : "status"}
        aria-live={notice.severity === "error" ? "assertive" : "polite"}
        aria-atomic="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
      >
        <span
          class={`status ${severityClasses[notice.severity].status} global-notice-marker col-start-1 row-start-1 mt-2`}
          aria-hidden="true"
        ></span>
        <div class="col-start-2 row-start-1 min-w-0 text-base-content">
          <h2 id={titleId} class="text-base/snug font-bold wrap-break-word">{notice.title}</h2>
          <p id={messageId} class="mt-1 max-w-[70ch] text-sm/normal wrap-break-word opacity-80">
            {notice.message}
          </p>
        </div>
        {#if notice.action}
          <div
            class="col-start-2 -col-end-1 row-start-2 flex min-w-0 lg:col-start-3 lg:col-end-auto lg:row-start-1 lg:justify-end"
          >
            <a
              class="btn btn-outline btn-sm touch-target max-w-full rounded-full"
              href={notice.action.href}
              target={notice.action.target}
              aria-label={getActionAriaLabel(notice.action.label, notice.action.target)}
              rel={notice.action.target === "_blank"
                ? (notice.action.rel ?? "noreferrer")
                : notice.action.rel}
            >
              <span class="truncate">{notice.action.label}</span>
              {#if notice.action.target === "_blank"}
                <Icon icon={openInNewIcon} class="size-4 shrink-0" aria-hidden="true" />
              {/if}
            </a>
          </div>
        {/if}
        {#if notice.dismissible !== false}
          <button
            class="btn btn-ghost btn-circle btn-sm touch-target col-start-3 row-start-1 lg:col-start-4"
            type="button"
            aria-label={`${dismissLabel}: ${notice.title}`}
            title={dismissLabel}
            onclick={() => dismissNotice(notice)}
          >
            <Icon icon={closeIcon} class="size-5" aria-hidden="true" />
          </button>
        {/if}
      </article>
    {/each}
  </div>
{/if}
