<script lang="ts">
  import { page } from "$app/state";

  // account-site has no i18n runtime yet, so this copy matches the rest of the
  // app's English-only strings.
  const status = $derived(page.status);
  // Only server-side failures (5xx) are worth retrying; 4xx means the request
  // itself cannot succeed, so it gets the not-found copy and a way home.
  const isUnexpected = $derived(status >= 500);
  const title = $derived(isUnexpected ? "This page couldn't load" : "We couldn't find that page");
  const description = $derived(
    isUnexpected
      ? "Something went wrong while loading this page."
      : "The link may be outdated, or this page is not available yet."
  );
  const currentPath = $derived(`${page.url.pathname}${page.url.search}`);
</script>

<svelte:head>
  <title>{status} | Sekai Account</title>
</svelte:head>

<main id="main-content" class="hero min-h-svh px-3 py-8 sm:px-6 lg:py-12">
  <div class="hero-content w-full max-w-2xl p-0">
    <article
      class="card w-full border border-(--archive-border-subtle) bg-(--archive-surface-default) text-center"
      aria-labelledby="account-route-error-title"
    >
      <div class="card-body items-center gap-6 p-6 sm:p-10">
        <div class="max-w-xl">
          <p class="mb-3 text-sm font-semibold text-primary">Sekai Account</p>
          <h1
            id="account-route-error-title"
            class="text-3xl/tight font-bold tracking-normal text-(--archive-text-strong)"
          >
            {title}
          </h1>
          <p class="mt-4 text-base/7 text-(--archive-text-muted)">{description}</p>
          {#if isUnexpected}
            <p class="mt-2 text-sm/6 text-(--archive-text-muted)">
              Try loading the page again, or return to the account home.
            </p>
          {/if}
        </div>

        <div
          class="card-actions flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row"
        >
          <a class="btn btn-primary min-h-11" href="/">Back to home</a>
          {#if isUnexpected}
            <a class="btn btn-outline min-h-11" href={currentPath} data-sveltekit-reload>
              Try again
            </a>
          {/if}
        </div>
      </div>
    </article>
  </div>
</main>
