<script lang="ts">
  import { env } from "$env/dynamic/public";
  import { resolve } from "$app/paths";
  import Icon from "@iconify/svelte";
  import PageHeader from "$lib/components/shared/PageHeader.svelte";
  import {
    createI18nTranslator,
    getLocalI18nMessages,
    resolveStreamingMessages
  } from "$lib/i18n/runtime";
  import { createPageTitle } from "$lib/page-title";
  import { getKofiSupportUrl, getPatreonSupportUrl } from "$lib/support-provider-url";
  import type { PageData } from "./$types";

  const SUPPORT_I18N_NAMESPACES = ["common", "home", "error"] as const;

  let { data }: { data: PageData } = $props();

  const messages = $derived({
    ...getLocalI18nMessages(SUPPORT_I18N_NAMESPACES),
    ...resolveStreamingMessages(data.i18nMessages, SUPPORT_I18N_NAMESPACES)
  });
  const translate = $derived(createI18nTranslator(data.uiLocale, messages));
  const pageTitle = $derived(translate("support.title"));
  const patreonUrl = getPatreonSupportUrl(env.PUBLIC_PATREON_URL);
  const kofiUrl = getKofiSupportUrl(env.PUBLIC_KOFI_URL);
</script>

<svelte:head>
  <title>{createPageTitle(pageTitle)}</title>
</svelte:head>

<section class="content-page-shell gap-5 px-2 pb-6 sm:px-4">
  <PageHeader
    breadcrumbs={[{ label: translate("home"), href: resolve("/") }, { label: pageTitle }]}
  />

  <section aria-labelledby="support-title">
    <h1 id="support-title" class="mb-4 text-2xl font-semibold text-(--archive-text-strong)">
      {pageTitle}
    </h1>
    <p class="mb-5 max-w-3xl leading-7 text-(--archive-text-default)">
      {translate("support.description")}
    </p>

    <div class="grid gap-4 lg:grid-cols-2">
      <section
        aria-labelledby="support-donations-title"
        class="content-card-shell flex flex-col gap-3 rounded-xl border p-5 sm:p-6"
      >
        <h2 id="support-donations-title" class="text-base font-semibold text-(--archive-text-strong)">
          {translate("support.donations")}
        </h2>
        {#if patreonUrl || kofiUrl}
          <div class="flex flex-col gap-2">
            {#if patreonUrl}
              <a
                class="btn btn-outline min-h-12 justify-start gap-3 px-4"
                href={patreonUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon icon="mdi:patreon" class="size-5 shrink-0" aria-hidden="true" />
                Patreon
                <Icon
                  icon="mdi:open-in-new"
                  class="ml-auto size-4 opacity-70"
                  aria-hidden="true"
                />
              </a>
            {/if}
            {#if kofiUrl}
              <a
                class="btn btn-outline min-h-12 justify-start gap-3 px-4"
                href={kofiUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon icon="mdi:coffee" class="size-5 shrink-0" aria-hidden="true" />
                Ko-fi
                <Icon
                  icon="mdi:open-in-new"
                  class="ml-auto size-4 opacity-70"
                  aria-hidden="true"
                />
              </a>
            {/if}
          </div>
        {:else}
          <p role="status" class="text-sm text-(--archive-text-muted)">
            {translate("support.empty")}
          </p>
        {/if}
      </section>

      <section
        aria-labelledby="support-other-ways-title"
        class="content-card-shell flex flex-col gap-3 rounded-xl border p-5 sm:p-6"
      >
        <h2 id="support-other-ways-title" class="text-base font-semibold text-(--archive-text-strong)">
          {translate("support.otherWays")}
        </h2>

        <div class="flex flex-col gap-2">
          <a
            class="btn btn-outline min-h-12 w-full justify-start gap-3 px-4"
            href="https://twitter.com/SekaiViewer"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon icon="mdi:twitter" class="size-5 shrink-0" aria-hidden="true" />
            {translate("support.followX")}
            <Icon
              icon="mdi:open-in-new"
              class="ml-auto size-4 opacity-70"
              aria-hidden="true"
            />
          </a>

          <a
            class="btn btn-outline min-h-12 w-full justify-start gap-3 px-4"
            href="https://github.com/Sekai-World/sekai-viewer-reborn"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon icon="mdi:github" class="size-5 shrink-0" aria-hidden="true" />
            {translate("support.contributeCode")}
            <Icon
              icon="mdi:open-in-new"
              class="ml-auto size-4 opacity-70"
              aria-hidden="true"
            />
          </a>
        </div>
      </section>
    </div>
  </section>
</section>
