<script lang="ts">
  import Icon from "@iconify/svelte";
  import "$lib/icons/mdi";

  let {
    version,
    title,
    message,
    actionLabel,
    dismissLabel,
    onRead,
    onDismiss
  }: {
    version: string;
    title: string;
    message: string;
    actionLabel: string;
    dismissLabel: string;
    onRead: () => void;
    onDismiss: () => void;
  } = $props();
</script>

<section
  class="alert alert-info flex flex-col items-stretch gap-3 border border-(--archive-border-default) bg-(--archive-surface-default) p-3 text-(--archive-text-default) sm:flex-row sm:items-start sm:gap-4 sm:p-4"
  role="alert"
>
  <Icon
    icon="mdi:information-outline"
    class="mt-0.5 size-6 shrink-0 text-info"
    aria-hidden="true"
  />
  <div class="min-w-0 flex-1">
    <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <h2 class="wrap-break-word font-semibold">{title}</h2>
      <span
        class="content-card-inset max-w-full break-all rounded-md border border-(--archive-border-subtle) px-2 py-0.5 font-mono text-xs text-(--archive-text-muted)"
      >
        {version}
      </span>
    </div>
    <p class="mt-1 wrap-break-word text-sm/6 text-(--archive-text-muted)">{message}</p>
  </div>
  <div class="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
    <button type="button" class="btn btn-link min-h-11 min-w-11 px-2" onclick={onRead}>
      {actionLabel}
    </button>
    <button
      type="button"
      class="btn btn-ghost btn-square min-h-11 min-w-11"
      aria-label={dismissLabel}
      onclick={onDismiss}
    >
      <Icon icon="mdi:close" class="size-5" aria-hidden="true" />
    </button>
  </div>
</section>
