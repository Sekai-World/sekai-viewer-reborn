# i18n Translation Workflow (sekai-i18n-reborn)

## Overview

`content-site` i18n strings live in `sekai-i18n-reborn`, loaded at runtime from CDN.
Source strings are authored in `packages/i18n-source/content-site/*.json` inside
`sekai-viewer-reborn`, then synced to `sekai-i18n-reborn` via
`.github/workflows/i18n-sync.yml`.

## Translation PR Flow

1. English source strings added/changed in `packages/i18n-source/content-site/*.json`.
2. `i18n-sync.yml` bot pushes a sync PR to `Sekai-World/sekai-i18n-reborn` (branch `sync/content-site-i18n-source`).
3. Manual translation PRs add ja/ko/zh-CN/zh-TW translations for the new English keys.
4. Merge order does not matter — each locale PR is independent.

## Lessons Learned

### Server-localized terminology is critical

Different PJSK servers use different localized terms for the same concept.
Translations MUST use the official server term, not a literal translation
from Japanese or a term borrowed from another game.

**Critical example**: CN server uses 扭蛋 (niǔdàn) for gacha, NOT 祈愿 (qíyuàn).
"祈愿" is the Genshin Impact gacha term; using it in PJSK CN context is wrong.

Verify terminology from: official game site, 百度贴吧, Moesekai, Fandom wiki
for the specific server region.

### Canonical terminology table

See the workspace-root `docs/game-data-knowledge/regions-and-locales.md` →
"各服官方用语照" section for the confirmed JP/CN/TW/EN term mapping table.

### Bulk replace workflow

When a terminology error is discovered across many keys:
1. `grep -rn` to find all affected occurrences across all locale files.
2. Use `replaceAll` edits on each affected file.
3. Verify no occurrences remain with a second `grep`.
4. Check for related issues (e.g., leading spaces in SIDE STORY strings were
   found during the same pass).

### SIDE STORY label formatting

`cardEpisodesTitle` and `episodeBonusLabel` should NOT have leading spaces
before "SIDE STORY". The English source has no leading space; translations
must match.

## Namespace Files

- `card.json` — card detail page strings
- `gacha.json` — gacha list/detail/simulator strings
- `common.json` — navigation, settings, shared labels
- `server.json` — server-side error/status messages
- `event.json` — event list/detail strings
- `music.json` — music list/detail strings