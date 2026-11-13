<script lang="ts">
  import { resolveChibiModelDescriptor } from "#lib/chibi/chibi-model.js";
  import {
    createChibiPlayer,
    type ChibiModelResource,
    type ChibiPlayer
  } from "#lib/chibi/chibi-player.js";
  import { createChibiRuntimeFacade } from "#lib/chibi/chibi-spine-runtime.js";

  // One model from each family.
  const SAMPLE_MODELS = ["sd_01ichika_normal", "v2_sd_01ichika_casual", "sd_mob001"] as const;

  let host = $state<HTMLDivElement>();
  let modelName = $state<string>(SAMPLE_MODELS[0]);
  let animations = $state<readonly string[]>([]);
  let animation = $state("");
  let status = $state("idle");

  let player: ChibiPlayer | undefined;
  let resource: ChibiModelResource | undefined;

  $effect(() => {
    const target = host;
    const result = resolveChibiModelDescriptor(modelName);
    if (!target) return;
    if (result.status !== "ok") {
      status = `invalid: ${result.reason}`;
      return;
    }

    const controller = new AbortController();
    let loaded: ChibiModelResource | undefined;
    status = "loading";
    animations = [];
    player ??= createChibiPlayer(createChibiRuntimeFacade());
    player.load(result.descriptor, target, controller.signal).then(
      (next) => {
        if (controller.signal.aborted) {
          next.destroy();
          return;
        }
        loaded = next;
        resource = next;
        animations = next.animations;
        animation = next.animations[0] ?? "";
        if (animation) next.setAnimation(animation);
        status = "ready";
      },
      (cause: unknown) => {
        if (!controller.signal.aborted) status = `error: ${String(cause)}`;
      }
    );

    return () => {
      controller.abort();
      loaded?.destroy();
      if (resource === loaded) resource = undefined;
    };
  });
</script>

<svelte:head>
  <title>Chibi player preview</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="flex flex-col gap-4 p-4">
  <div class="flex flex-wrap items-center gap-2">
    <select class="select select-sm w-auto" aria-label="Model" bind:value={modelName}>
      {#each SAMPLE_MODELS as name (name)}
        <option value={name}>{name}</option>
      {/each}
    </select>
    <select
      class="select select-sm w-auto"
      aria-label="Animation"
      bind:value={animation}
      onchange={() => resource?.setAnimation(animation)}
    >
      {#each animations as name (name)}
        <option value={name}>{name}</option>
      {/each}
    </select>
    <span data-testid="chibi-status">{status}</span>
    <span data-testid="chibi-animation-count">{animations.length}</span>
  </div>
  <div bind:this={host} class="bg-base-200 h-[480px] w-full max-w-[480px]"></div>
</div>
