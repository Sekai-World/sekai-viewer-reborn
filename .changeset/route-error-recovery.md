---
"@apps/tools-site": patch
"@apps/account-site": patch
"@apps/content-site": patch
"@apps/media-lab-site": patch
"@platform/i18n-source": patch
---

Add localized route error pages to tools-site and account-site so expected 404s and unexpected load failures show a heading, a way home, and a retry instead of the bare framework status text. Tools-site now logs each unexpected server error once with a correlation id, status, method, and route pattern, without the request URL, query, headers, or cookies, and returns only a generic message to the browser. Content-site and media-lab-site only pick up the shared i18n source package.
