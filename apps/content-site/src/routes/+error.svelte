<script lang="ts">
  import Icon from "@iconify/svelte";
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import { createCommonTranslator } from "$lib/i18n";
  import type { LayoutData } from "./$types";

  let { data }: { data: LayoutData } = $props();
  const translate = $derived(createCommonTranslator(data.uiLocale, data.commonMessages));
  const status = $derived(page.status);
  const title = $derived(
    status === 404 ? translate("errorPage.notFoundTitle") : translate("errorPage.title")
  );
  const description = $derived(
    status === 404
      ? translate("errorPage.notFoundDescription")
      : translate("errorPage.description")
  );
  const icon = $derived(status === 404 ? "mdi:map-search-outline" : "mdi:refresh-circle");
  const currentPath = $derived(`${page.url.pathname}${page.url.search}`);
</script>

<svelte:head>
  <title>{status} | Sekai Viewer</title>
</svelte:head>

<section class="hero min-h-[calc(100svh-10rem)] px-3 py-8 sm:px-6 lg:py-12">
  <div class="hero-content w-full max-w-3xl p-0">
    <article
      class="card content-card-shell w-full border-base-content/10 text-center shadow-sm"
      aria-labelledby="route-error-title"
    >
      <div class="card-body items-center gap-6 p-6 sm:p-10 lg:p-12">
        <div
          class="grid h-20 w-20 place-items-center rounded-full border border-primary/20 bg-primary/10 text-primary sm:h-24 sm:w-24"
        >
          <Icon icon={icon} class="h-10 w-10 sm:h-12 sm:w-12" aria-hidden="true" />
        </div>

        <div class="max-w-xl">
          <p class="mb-3 text-sm font-semibold text-primary">{translate("errorPage.kicker")}</p>
          <h1
            id="route-error-title"
            class="text-3xl font-bold leading-tight tracking-normal text-base-content sm:text-4xl"
          >
            {title}
          </h1>

          <p class="mt-4 text-base leading-7 text-base-content/70">
            {description}
          </p>
          <p class="mt-2 text-sm leading-6 text-base-content/60">
            {translate("errorPage.nextStep")}
          </p>
        </div>

        <div class="card-actions flex w-full flex-row justify-center gap-3 sm:w-auto">
          <a class="btn btn-primary" href={resolve("/")}>
            <Icon icon="mdi:home-variant-outline" class="h-5 w-5" aria-hidden="true" />
            {translate("errorPage.homeAction")}
          </a>
          <a class="btn btn-outline" href={currentPath}>
            <Icon icon="mdi:reload" class="h-5 w-5" aria-hidden="true" />
            {translate("errorPage.retryAction")}
          </a>
        </div>

        {#if status !== 404}
          <div class="alert alert-soft mt-2 max-w-xl text-left">
            <Icon icon="mdi:information-outline" class="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>{translate("errorPage.tryLater")}</span>
          </div>
        {/if}
      </div>
    </article>
  </div>
</section>
