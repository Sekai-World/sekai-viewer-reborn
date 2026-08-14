<script lang="ts">
  import { isThemeMode, themeModes, themeNames, type ThemeMode, type ThemeName } from "./theme-controls.types";
  type Props = { themeName: ThemeName; themeMode: ThemeMode; paletteLabel: string; modeLabel: string; labels: Record<ThemeName | ThemeMode, string>; onThemeNameChange: (value: ThemeName) => void; onThemeModeChange: (value: ThemeMode) => void; };
  let { themeName, themeMode, paletteLabel, modeLabel, labels, onThemeNameChange, onThemeModeChange }: Props = $props();
</script>
<div class="flex items-center gap-1" aria-label={`${paletteLabel}. ${modeLabel}`}>
  <div class="join" role="group" aria-label={paletteLabel}>{#each themeNames as value (value)}<button type="button" class={`btn btn-sm join-item border-base-content/20 ${themeName === value ? "btn-primary" : "btn-outline bg-base-100/65"}`} aria-pressed={themeName === value} onclick={() => onThemeNameChange(value)}><span class="sr-only">{labels[value]}</span><span class={`size-3 rounded-full border border-base-content/20 ${value === "default" ? "bg-indigo-500" : value === "sakura" ? "bg-pink-400" : "bg-teal-400"}`} aria-hidden="true"></span></button>{/each}</div>
  <select class="select select-sm w-20 border-base-content/20 bg-base-100/65 text-xs" aria-label={modeLabel} value={themeMode} onchange={(event) => { const value = event.currentTarget.value; if (isThemeMode(value)) onThemeModeChange(value); }}>{#each themeModes as value (value)}<option value={value}>{labels[value]}</option>{/each}</select>
</div>
