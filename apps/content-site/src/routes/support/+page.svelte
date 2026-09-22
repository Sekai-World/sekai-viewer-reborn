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
    <div class="content-card-shell flex flex-wrap gap-3 rounded-xl border p-4 sm:p-5">
      {#if patreonUrl || kofiUrl}
        {#if patreonUrl}
          <a
            class="btn btn-outline min-h-11 gap-2"
            href={patreonUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Patreon
            <Icon icon="mdi:open-in-new" class="size-4" aria-hidden="true" />
          </a>
        {/if}
        {#if kofiUrl}
          <a
            class="btn btn-outline min-h-11 gap-2"
            href={kofiUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Ko-fi
            <Icon icon="mdi:open-in-new" class="size-4" aria-hidden="true" />
          </a>
        {/if}
      {:else}
        <p role="status" class="text-sm text-(--archive-text-muted)">
          {translate("support.empty")}
        </p>
      {/if}
    </div>
  </section>
</section>
