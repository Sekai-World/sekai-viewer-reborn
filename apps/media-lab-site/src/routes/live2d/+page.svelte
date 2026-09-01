<script lang="ts">
  import { goto } from "$app/navigation";
  import Icon from "@iconify/svelte";
  import Live2dModelSelector from "$lib/components/Live2dModelSelector.svelte";
  import { createI18nTranslator } from "$lib/i18n/runtime";
  import { previewLive2dModelEntries } from "$lib/live2d/model-catalog";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const translate = $derived(createI18nTranslator(data.uiLocale, data.i18nMessages));

  // Placeholder catalog entries resolve their display strings through the
  // route translator so the selector stays reusable without local strings.
  const modelOptions = $derived(
    previewLive2dModelEntries.map((entry) => ({
      id: entry.id,
      title: translate(entry.titleKey),
      description: translate(entry.descriptionKey)
    }))
  );
  const selectorLabels = $derived({
    previewBadge: translate("live2d.modelSelector.previewBadge"),
    inputLabel: translate("live2d.modelSelector.inputLabel"),
    inputPlaceholder: translate("live2d.modelSelector.inputPlaceholder"),
    inputHint: translate("live2d.modelSelector.inputHint"),
    inputError: translate("live2d.modelSelector.inputError"),
    inputAction: translate("live2d.modelSelector.inputAction"),
    empty: translate("live2d.modelSelector.empty")
  });
  const openModel = (modelId: string): void => {
    void goto(`/live2d/${modelId}`);
  };
</script>

<svelte:head>
  <title>{translate("live2d.title")}</title>
</svelte:head>

<section aria-labelledby="live2d-title" class="flex flex-col gap-6">
  <header class="max-w-2xl">
    <p class="text-sm font-semibold text-primary">{translate("live2d.kicker")}</p>
    <h1 id="live2d-title" class="mt-1 text-3xl font-bold tracking-tight text-base-content">
      {translate("live2d.title")}
    </h1>
    <p class="mt-3 text-base/7 text-base-content/75">{translate("live2d.description")}</p>
  </header>

  <article class="card bg-base-100 shadow-sm ring-1 ring-base-content/10">
    <div class="card-body gap-4 p-5 sm:p-6">
      <div class="flex items-start gap-4">
        <span
          class="grid size-11 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary"
        >
          <Icon icon="mdi:flask-outline" class="size-6" aria-hidden="true" />
        </span>
        <div>
          <h2 class="card-title text-lg">{translate("live2d.modelSelector.title")}</h2>
          <p class="mt-2 text-sm/6 text-base-content/70">
            {translate("live2d.modelSelector.description")}
          </p>
        </div>
      </div>
      <Live2dModelSelector
        models={modelOptions}
        labels={selectorLabels}
        onOpenModel={openModel}
      />
    </div>
  </article>
</section>
