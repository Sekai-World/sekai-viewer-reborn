<script lang="ts">
  import { trackPageLeave, type PageLeaveNavigation } from "../page-leave.svelte";

  type Props = {
    beforeNavigate: (callback: (navigation: PageLeaveNavigation) => void) => void;
  };

  let { beforeNavigate }: Props = $props();
  // svelte-ignore state_referenced_locally
  const pageLeave = trackPageLeave(beforeNavigate);
</script>

<output>{pageLeave.leaving ? "leaving" : "idle"}</output>
