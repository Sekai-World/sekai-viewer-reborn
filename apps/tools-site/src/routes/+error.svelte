<script lang="ts">
  import Icon from "@iconify/svelte";
  import { page } from "$app/state";
  import type { I18nMessages } from "@platform/i18n-runtime";
  import { createI18nTranslator, getLocalI18nMessages } from "#lib/i18n/runtime.js";

  const fallbackMessages = getLocalI18nMessages(["common"]);
  const isMessages = (value: unknown): value is I18nMessages =>
    value !== null && typeof value === "object" && !Array.isArray(value);
  // A page-level error keeps the root layout data, so reuse its locale and
  // dictionary; the bundled English source covers layout data without them.
  // (A failed root layout load renders SvelteKit's static error.html instead.)
  const uiLocale = $derived(typeof page.data.uiLocale === "string" ? page.data.uiLocale : "en");
  const messages = $derived(
    isMessages(page.data.i18nMessages)
      ? { ...fallbackMessages, ...page.data.i18nMessages }
      : fallbackMessages
  );
  const translate = $derived(createI18nTranslator(uiLocale, messages));
  const status = $derived(page.status);
  // Only server-side failures (5xx) are worth retrying; 4xx means the request
  // itself cannot succeed, so it gets the not-found copy and a way home.
  const isUnexpected = $derived(status >= 500);
  const title = $derived(
    isUnexpected ? translate("errorPage.title") : translate("errorPage.notFoundTitle")
  );
  const description = $derived(
    isUnexpected ? translate("errorPage.description") : translate("errorPage.notFoundDescription")
  );
  const icon = $derived(isUnexpected ? "mdi:alert-circle-outline" : "mdi:map-search-outline");
  const currentPath = $derived(`${page.url.pathname}${page.url.search}`);
</script>

<svelte:head>
  <title>{status} | {translate("errorPage.kicker")}</title>
</svelte:head>

<section class="hero min-h-[calc(100svh-16rem)] px-3 py-8 sm:px-6 lg:py-12">
  <div class="hero-content w-full max-w-2xl p-0">
    <article
      class="card w-full border border-(--archive-border-subtle) bg-(--archive-surface-default) text-center"
      aria-labelledby="tools-route-error-title"
    >
      <div class="card-body items-center gap-6 p-6 sm:p-10">
        <div
          class="grid size-20 place-items-center rounded-full border border-primary/20 bg-primary/10 text-primary"
        >
          <Icon {icon} class="size-10" aria-hidden="true" />
        </div>

        <div class="max-w-xl">
          <p class="mb-3 text-sm font-semibold text-primary">{translate("errorPage.kicker")}</p>
          <h1
            id="tools-route-error-title"
            class="text-3xl/tight font-bold tracking-normal text-(--archive-text-strong)"
          >
            {title}
          </h1>
          <p class="mt-4 text-base/7 text-(--archive-text-muted)">{description}</p>
          {#if isUnexpected}
            <p class="mt-2 text-sm/6 text-(--archive-text-muted)">
              {translate("errorPage.nextStep")}
            </p>
          {/if}
        </div>

        <div
          class="card-actions flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row"
        >
          <a class="btn btn-primary min-h-11" href="/">
            <Icon icon="mdi:home-variant-outline" class="size-5" aria-hidden="true" />
            {translate("errorPage.homeAction")}
          </a>
          {#if isUnexpected}
            <a class="btn btn-outline min-h-11" href={currentPath} data-sveltekit-reload>
              <Icon icon="mdi:refresh" class="size-5" aria-hidden="true" />
              {translate("errorPage.retryAction")}
            </a>
          {/if}
        </div>
      </div>
    </article>
  </div>
</section>
