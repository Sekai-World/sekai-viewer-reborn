---
"@apps/tools-site": patch
"@apps/account-site": patch
"@apps/content-site": patch
"@apps/media-lab-site": patch
"@platform/i18n-source": patch
---

Add route error pages to tools-site (localized) and account-site (English) so expected 404s and other request errors show a heading and a way home, with a retry only for unexpected server errors, instead of the bare framework status text. Tools-site now logs each unexpected server error once with a correlation id, status, method, route pattern, and its cause chain, without the request URL, query, headers, or cookies, and returns only a generic message to the browser. Content-site and media-lab-site only pick up the shared i18n source package.
