<script lang="ts">
  let {
    dialog = $bindable<HTMLDialogElement | null>(null),
    title,
    closeLabel,
    json
  }: {
    dialog: HTMLDialogElement | null;
    title: string;
    closeLabel: string;
    json: string;
  } = $props();
</script>

<dialog bind:this={dialog} class="modal">
  <div class="modal-box max-w-5xl">
    <div class="mb-4 flex items-center justify-between gap-3">
      <h3 class="text-lg font-semibold">{title}</h3>
      <form method="dialog">
        <button type="submit" class="btn btn-sm btn-ghost">{closeLabel}</button>
      </form>
    </div>
    <pre
      class="content-card-inset max-h-[70vh] overflow-auto rounded-xl p-3 sm:p-4 text-xs/6"><code
        >{json}</code
      ></pre>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button type="submit">{closeLabel}</button>
  </form>
</dialog>
