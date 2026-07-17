<script lang="ts">
  type DetailSkeletonKind = "card" | "event" | "music" | "gacha" | "virtual-live";

  let { kind }: { kind: DetailSkeletonKind } = $props();

  const isMusic = $derived(kind === "music");
  const usesTabs = $derived(kind === "card" || kind === "event" || kind === "gacha");
  const infoRowCount = $derived(kind === "virtual-live" ? 7 : kind === "music" ? 6 : 5);
  const rightCardCount = $derived(kind === "event" || kind === "gacha" ? 3 : 2);
  const mediaAspectClass = $derived(
    kind === "card" ? "aspect-21/10" : kind === "event" ? "aspect-5/2" : "aspect-16/7"
  );
</script>

<div
  aria-hidden="true"
  class:md:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]={!isMusic}
  class:lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]={true}
  class="grid grid-cols-1 gap-4 md:items-start lg:items-start"
>
  <div class="flex min-w-0 flex-col gap-4">
    {#if isMusic}
      <div class="skeleton aspect-square w-full rounded-2xl"></div>
    {:else}
      <article class="card content-card-shell overflow-hidden shadow-sm">
        <div class="card-body gap-3 p-3 sm:gap-4 sm:p-5">
          {#if usesTabs}
            <div class="flex h-9 gap-1 rounded-xl bg-base-200/70 p-1">
              <div class="skeleton h-7 min-w-20 flex-1 rounded-lg"></div>
              <div class="skeleton h-7 min-w-16 flex-1 rounded-lg opacity-70"></div>
              {#if kind === "event" || kind === "gacha"}
                <div class="skeleton hidden h-7 min-w-16 flex-1 rounded-lg opacity-50 sm:block"></div>
              {/if}
            </div>
          {/if}
          <div class={`skeleton w-full rounded-2xl ${mediaAspectClass}`}></div>
        </div>
      </article>
    {/if}

    <article class="card content-card-shell shadow-sm">
      <div class="card-body gap-4 p-3 sm:p-5">
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-2">
            <div class="skeleton size-4 rounded"></div>
            <div class="skeleton h-3 w-24 rounded"></div>
          </div>
          <div class="skeleton h-6 w-14 rounded-full"></div>
        </div>
        <div class="space-y-2">
          {#each Array(infoRowCount) as _, index (index)}
            <div class="content-card-inset rounded-xl p-3 sm:px-4">
              <div class="skeleton h-3 w-20 rounded"></div>
              <div
                class={`skeleton mt-2 h-4 rounded ${index % 3 === 0 ? "w-2/3" : index % 3 === 1 ? "w-1/2" : "w-4/5"}`}
              ></div>
            </div>
          {/each}
        </div>
      </div>
    </article>

    {#if kind === "event" || kind === "gacha"}
      <article class="card content-card-shell shadow-sm">
        <div class="card-body gap-4 p-3 sm:p-5">
          <div class="flex items-center gap-2">
            <div class="skeleton size-4 rounded"></div>
            <div class="skeleton h-3 w-28 rounded"></div>
          </div>
          <div class="content-card-inset rounded-xl p-4">
            <div class="skeleton h-7 w-2/3 rounded"></div>
            <div class="skeleton mt-3 h-3 w-full rounded-full"></div>
          </div>
        </div>
      </article>
    {/if}
  </div>

  <div class="flex min-w-0 flex-col gap-4">
    {#each Array(rightCardCount) as _, cardIndex (cardIndex)}
      <article class="card content-card-shell shadow-sm">
        <div class="card-body gap-4 p-3 sm:p-5">
          <div class="flex items-center gap-2">
            <div class="skeleton size-4 rounded"></div>
            <div class="skeleton h-3 w-28 rounded"></div>
          </div>

          {#if kind === "gacha" && cardIndex === 0}
            <div class="grid grid-cols-4 gap-2 sm:grid-cols-5 xl:grid-cols-6">
              {#each Array(6) as _, index (index)}
                <div class="skeleton aspect-square rounded-lg"></div>
              {/each}
            </div>
          {:else if kind === "music" && cardIndex === 0}
            <div class="content-card-inset space-y-3 rounded-xl p-4">
              <div class="skeleton h-5 w-1/2 rounded"></div>
              <div class="skeleton h-12 w-full rounded-xl"></div>
              <div class="skeleton h-2 w-full rounded-full"></div>
            </div>
          {:else}
            <div class="grid gap-3 sm:grid-cols-2">
              {#each Array(cardIndex === 0 ? 4 : 2) as _, index (index)}
                <div class="content-card-inset rounded-xl p-3 sm:p-4">
                  <div class="skeleton h-3 w-20 rounded"></div>
                  <div class="skeleton mt-3 h-6 w-2/3 rounded"></div>
                  <div class="skeleton mt-2 h-3 w-full rounded"></div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </article>
    {/each}
  </div>
</div>
