<script lang="ts">
  import Icon from "@iconify/svelte";
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import { createI18nTranslator, resolveStreamingMessages } from "$lib/i18n/runtime";
  import type { LayoutData } from "./$types";

  let { data }: { data: LayoutData } = $props();
  let resolvedMessages = $state<Record<string, string> | null>(null);
  const messages = $derived(
    resolvedMessages ?? resolveStreamingMessages(data.i18nMessages, ["common", "error"])
  );
  $effect(() => {
    const messagesOrPromise = data.i18nMessages;
    resolvedMessages = resolveStreamingMessages(messagesOrPromise, ["common", "error"]);
    if (messagesOrPromise && typeof (messagesOrPromise as PromiseLike<Record<string, string>>).then === "function") {
      void Promise.resolve(messagesOrPromise).then((messages) => {
        if (messagesOrPromise === data.i18nMessages) resolvedMessages = messages;
      }).catch(() => {
        // Preserve the synchronous local fallback when streaming fails.
      });
    }
  });
  const translate = $derived(
    createI18nTranslator(data.uiLocale, messages)
  );
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
          class="grid size-20 place-items-center rounded-full border border-primary/20 bg-primary/10 text-primary sm:size-24"
        >
          <Icon {icon} class="size-10 sm:size-12" aria-hidden="true" />
        </div>

        <div class="max-w-xl">
          <p class="mb-3 text-sm font-semibold text-primary">{translate("errorPage.kicker")}</p>
          <h1
            id="route-error-title"
            class="text-3xl/tight font-bold tracking-normal text-base-content sm:text-4xl"
          >
            {title}
          </h1>

          <p class="mt-4 text-base/7 text-base-content/70">
            {description}
          </p>
          <p class="mt-2 text-sm/6 text-base-content/60">
            {translate("errorPage.nextStep")}
          </p>
        </div>

        <div class="card-actions flex w-full flex-row justify-center gap-3 sm:w-auto">
          <a class="btn btn-primary" href={resolve("/")}>
            <Icon icon="mdi:home-variant-outline" class="size-5" aria-hidden="true" />
            {translate("errorPage.homeAction")}
          </a>
          <a class="btn btn-outline" href={currentPath}>
            <Icon icon="mdi:reload" class="size-5" aria-hidden="true" />
            {translate("errorPage.retryAction")}
          </a>
        </div>

        {#if status !== 404}
          <div class="alert alert-soft mt-2 max-w-xl text-left">
            <Icon icon="mdi:information-outline" class="size-5 shrink-0" aria-hidden="true" />
            <span>{translate("errorPage.tryLater")}</span>
          </div>
        {/if}
      </div>
    </article>
  </div>
</section>
