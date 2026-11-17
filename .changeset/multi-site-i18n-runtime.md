---
"@apps/tools-site": minor
"@apps/media-lab-site": minor
"@platform/i18n-runtime": minor
"@apps/content-site": patch
---

tools-site and media-lab-site now offer all 29 interface languages, listed by native name in the language selector, and load translations from their own dictionaries in `sekai-i18n-reborn`, falling back to English when a translation is missing. tools-site gains a language selector in the header and mobile settings menu. Both sites render the selected language and text direction on the page, so Arabic and Hebrew display right to left. `@platform/i18n-runtime` now exports the native locale names and the root `<html lang dir>` page transform that content-site already used.
