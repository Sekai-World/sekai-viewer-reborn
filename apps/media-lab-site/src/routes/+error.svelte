<script lang="ts">
  import Icon from "@iconify/svelte";
  import { page } from "$app/state";
  import { createI18nTranslator, getLocalI18nMessages } from "$lib/i18n/runtime";

  const fallbackMessages = getLocalI18nMessages(["common"]);
  const translate = createI18nTranslator("en", fallbackMessages);
  const status = $derived(page.status);
  const title = $derived(
    status === 404 ? translate("errorPage.notFoundTitle") : translate("errorPage.title")
  );
  const description = $derived(
    status === 404 ? translate("errorPage.notFoundDescription") : translate("errorPage.description")
  );
  const icon = $derived(status === 404 ? "mdi:map-search-outline" : "mdi:refresh-circle");
  const currentPath = $derived(`${page.url.pathname}${page.url.search}`);
</script>

<svelte:head>
  <title>{status} | {translate("shell.title")}</title>
</svelte:head>

<section class="hero min-h-[calc(100svh-16rem)] px-3 py-8 sm:px-6 lg:py-12">
  <div class="hero-content w-full max-w-2xl p-0">
    <article
      class="card w-full border border-base-content/10 bg-base-100 text-center shadow-sm"
      aria-labelledby="media-lab-route-error-title"
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
            id="media-lab-route-error-title"
            class="text-3xl/tight font-bold tracking-tight text-base-content"
          >
            {title}
          </h1>
          <p class="mt-4 text-base/7 text-base-content/70">{description}</p>
          <p class="mt-2 text-sm/6 text-base-content/60">{translate("errorPage.nextStep")}</p>
        </div>

        <div class="card-actions flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
          <a class="btn btn-primary" href="/">
            <Icon icon="mdi:home-variant-outline" class="size-5" aria-hidden="true" />
            {translate("errorPage.homeAction")}
          </a>
          <a class="btn btn-outline" href={currentPath}>
            <Icon icon="mdi:reload" class="size-5" aria-hidden="true" />
            {translate("errorPage.retryAction")}
          </a>
        </div>
      </div>
    </article>
  </div>
</section>
