# content-site first public launch readiness

Release boundary for the first public deployment of `content-site` (issue #302,
tracked by #301). The product has not been public before, so this is a fresh
deployment, not a production migration.

## 1. Legacy URL / old-domain compatibility

**Decision: not required at launch (pending owner sign-off).**

- No old domain or legacy URL contract has been identified for this launch, and
  #302 puts redirects out of scope until a compatibility requirement is
  approved. No redirect rules, ingress rewrites, or CDN rules are added.
- Existing redirects inside the app are internal route-shape redirects, not
  legacy-domain compatibility, and stay as they are:
  `/musics/:region/:id[/download[/progress]]` → `/music/...` (301, query kept)
  and `/events/:region/list[/data]` → the current events list (308).
- The owner must confirm this decision before launch. Record the confirmation
  (who, when) in #302.

If compatibility is later approved, this section must be completed before any
redirect ships:

| Item             | Required answer                                     |
| ---------------- | --------------------------------------------------- |
| Owner            | application, Ingress, or CDN                        |
| Source → target  | complete path map, one row per legacy pattern       |
| Status code      | 301/308 (permanent) or 302/307 (temporary), per row |
| Region policy    | how a legacy URL without a region maps to `:region` |
| Query parameters | preserved, dropped, or translated, per row          |

## 2. Event Tracker cross-site configuration

`PUBLIC_TOOLS_SITE_BASE_URL` is read at runtime by `content-site`
(`apps/content-site/src/lib/tools-site.ts`) and exposed in the Helm chart as
`apps.content-site.env.PUBLIC_TOOLS_SITE_BASE_URL`.

| State                              | Behavior                                        |
| ---------------------------------- | ----------------------------------------------- |
| Set, region is `jp`/`tw`/`en`/`kr` | Link to `<base>/tracker/<region>?eventId=<id>`  |
| Set, region is `cn`                | Hidden (tools-site tracker has no `cn` support) |
| Unset, empty, or whitespace        | Hidden for every region                         |

Trailing slashes on the base URL are trimmed. Entry points are the home
current-event cards and the event detail page.

Launch configuration: set the value to the public tools-site origin when
tools-site is deployed with the release; otherwise leave it empty and the
hidden entry is the intentional behavior. Use `--set-string` so the URL stays a
string:

```bash
--set-string apps.content-site.env.PUBLIC_TOOLS_SITE_BASE_URL=https://tools.example.com
```

The value must be the origin where the tools-site Ingress is actually served
(`apps.tools-site.ingress.host` plus its TLS setting), not an in-cluster
Service address, because the link is followed by the visitor's browser.

## 3. Browser smoke checklist

Run against the deployed release after rollout, and record the result in the
release notes or #302. Use a current event ID from each region.

Core pages (for each of `jp`, `tw`, `en`, `kr`, `cn`; skip a page only when the
region has no data and the page shows its availability state):

- [ ] Home `/` loads current-event cards and the region switcher works.
- [ ] `/cards/:region`, `/musics/:region`, `/events/:region` list pages load.
- [ ] One detail page each loads and renders images: `/card/:region/:id`,
      `/music/:region/:id`, `/event/:region/:id`.
- [ ] `/updates` shows the entry whose version matches
      `apps/content-site/package.json` (see AGENTS.md release notes rules).

Error states:

- [ ] A non-existent ID on a detail route shows a localized not-found or error
      state inside the site shell, not an unhandled 500.
- [ ] An unsupported region segment does not crash the page.
- [ ] A missing or unreachable API shows the site error page, not a blank page.

Tracker navigation (check each case from the table in section 2):

| Case                                                     | Where to look                            | Expected                                                                                    |
| -------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------- |
| `jp`, `tw`, `en`, `kr` with base set                     | Event detail and home current-event card | Tracker link present; opens the tools-site tracker for that region with that event selected |
| `cn` with base set                                       | Event detail and home                    | No tracker link                                                                             |
| Base unset (separate release or `kubectl set env` check) | Event detail and home                    | No tracker link for any region                                                              |

## 4. Release runbook additions

Follow the chart README (`deploy/helm/sekai-viewer-reborn/README.md`) for
install, upgrade, and rollback mechanics. In addition, before launch confirm
and record:

- **DNS**: records for `apps.content-site.ingress.host` (and tools-site host if
  the Tracker link is enabled) point at the cluster ingress.
- **Ingress / TLS**: the TLS Secret named by `ingress.tls.secretName` exists in
  the release namespace; `className` matches the cluster's controller.
- **Required environment**: `SEKAI_MASTER_API_BASE_URL`, `SEKAI_API_BASE_URL`,
  `PUBLIC_REMOTE_ASSET_BASE_URL` set; `PUBLIC_SEKAI_I18N_BASE_URL` reviewed;
  `PUBLIC_TOOLS_SITE_BASE_URL` set or intentionally empty.
- **Images**: versioned immutable tags (no `latest`), with the in-app update
  entry matching the content-site version being deployed.
- **Rollback**: note the previous known-good revision from
  `helm history viewer --namespace viewer`. For a first deployment there is no
  previous revision, so rollback means `helm uninstall` of the release and
  removing the DNS records, which the owner must approve beforehand.
  `helm upgrade --install --atomic` already reverts a failed rollout.
- **CDN**: if a CDN fronts the site, record its cache and purge policy; none is
  assumed by the chart.
