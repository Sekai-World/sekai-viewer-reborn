<script lang="ts">
  import { resolve } from "$app/paths";
  import Icon from "@iconify/svelte";
  import PageHeader from "$lib/components/shared/PageHeader.svelte";
  import {
    createI18nTranslator,
    getLocalI18nMessages,
    resolveStreamingMessages
  } from "$lib/i18n/runtime";
  import { createPageTitle } from "$lib/page-title";
  import { siteUpdates } from "$lib/site-updates";
  import type { PageData } from "./$types";

  const UPDATES_I18N_NAMESPACES = ["common", "error"] as const;

  let { data }: { data: PageData } = $props();

  const messages = $derived({
    ...getLocalI18nMessages(UPDATES_I18N_NAMESPACES),
    ...resolveStreamingMessages(data.i18nMessages, UPDATES_I18N_NAMESPACES)
  });
  const translate = $derived(createI18nTranslator(data.uiLocale, messages));
  const pageTitle = $derived(translate("updates.title"));
</script>

<svelte:head>
  <title>{createPageTitle(pageTitle)}</title>
</svelte:head>

<section class="content-page-shell gap-5 px-2 pb-6 sm:px-4">
  <PageHeader
    breadcrumbs={[{ label: translate("home"), href: resolve("/") }, { label: pageTitle }]}
  >
    {#snippet actions()}
      <a class="btn btn-outline min-h-11 gap-2" href={resolve("/")}>
        <Icon icon="mdi:home-variant-outline" class="size-4" aria-hidden="true" />
        {translate("updates.backToHome")}
      </a>
    {/snippet}
  </PageHeader>

  <section aria-labelledby="updates-title" class="flex flex-col gap-4">
    <h1 id="updates-title" class="text-2xl font-semibold text-(--archive-text-strong)">
      {pageTitle}
    </h1>

    <div class="flex flex-col gap-4">
      {#each siteUpdates as update, index (update.version)}
        <article
          aria-labelledby={`site-update-title-${index}`}
          class="content-card-shell flex min-w-0 flex-col gap-3 rounded-xl border p-4 sm:p-5"
        >
          <header class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            <h2
              id={`site-update-title-${index}`}
              class="text-lg font-semibold text-(--archive-text-strong)"
            >
              {translate(update.titleKey)}
            </h2>
            <span class="badge badge-outline max-w-full break-all">
              {translate("updates.versionLabel")}
              {update.version}
            </span>
          </header>

          <p class="leading-7 text-(--archive-text-default)">{translate(update.summaryKey)}</p>

          {#if update.changeKeys.length > 0}
            <ul
              class="content-card-inset list-disc space-y-2 rounded-lg border border-(--archive-border-subtle) p-4 pl-9 text-(--archive-text-default)"
            >
              {#each update.changeKeys as changeKey (changeKey)}
                <li class="leading-6">{translate(changeKey)}</li>
              {/each}
            </ul>
          {/if}
        </article>
      {/each}
    </div>
  </section>
</section>
