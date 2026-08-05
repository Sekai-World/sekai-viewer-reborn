# sekai-viewer-reborn Helm chart

This chart deploys the four Sekai Viewer Reborn web applications as one Helm
release:

- `content-site`
- `tools-site`
- `media-lab-site`
- `account-site`

Each application is independently controlled by
`apps.<app-name>.enabled`. Enabled applications receive a Deployment, a
ClusterIP Service on port 80 targeting container port 3000, an Ingress by
default, and a PodDisruptionBudget by default. The chart does not create a
Namespace. Helm scopes all rendered resource names to the namespace selected
for the release.

## Validate and render

Before installing, ensure Helm is available and that `kubectl` can access the
intended Kubernetes cluster and namespace. The chart does not create a
Namespace, so `--create-namespace` only creates the namespace selected by
`--namespace`; it does not add a Namespace resource to the release.

Create the operator-owned values file once from the chart defaults, then edit
it before use. The command fails rather than overwriting an existing file;
preserve this file for later upgrades:

```bash
test ! -e viewer-values.yaml && cp deploy/helm/sekai-viewer-reborn/values.yaml viewer-values.yaml
```

In `viewer-values.yaml`, replace every placeholder image repository and tag,
Ingress host, and TLS Secret name with values for the target environment. Use
versioned immutable image tags rather than `latest`. Set the required
`content-site` values `SEKAI_MASTER_API_BASE_URL`, `SEKAI_API_BASE_URL`, and
`PUBLIC_REMOTE_ASSET_BASE_URL`; review the default i18n URL and all other
application settings as well. Keep this operator-owned file outside the chart
if it contains environment-specific or sensitive configuration.

The default preferred pod anti-affinity spreads replicas of each application,
not different applications in the suite, by replacing the reserved
`__APP_NAME__` value in the default affinity with the app currently being
rendered. An operator replacing `affinity` can provide its own cluster-specific
scheduling policy without Helm evaluating that value as a template.

Render and lint the chart before applying it:

```bash
helm lint deploy/helm/sekai-viewer-reborn
helm template viewer deploy/helm/sekai-viewer-reborn \
  --namespace viewer \
  --values viewer-values.yaml \
  > /tmp/sekai-viewer-helm.yaml
kubectl apply --dry-run=client -f /tmp/sekai-viewer-helm.yaml
```

The content-site-only render used in CI and troubleshooting can be produced by
adding the app-disable flags and explicit URL values shown below. Do not apply
rendered output directly in place of Helm; use it to inspect and validate the
resources Helm will manage.

## First installation

Install the release with the operator-owned values file. `--wait` waits for
resources to become ready, and `--timeout` bounds that wait:

```bash
helm upgrade --install viewer deploy/helm/sekai-viewer-reborn \
  --namespace viewer \
  --create-namespace \
  --values viewer-values.yaml \
  --atomic \
  --timeout 10m
```

`--atomic` waits for the release and automatically rolls it back if the
installation fails; `--timeout` bounds that wait. This keeps a failed first
installation from remaining in a partial state.

Run Helm's chart validation from the repository root:

```bash
helm lint deploy/helm/sekai-viewer-reborn
helm template viewer deploy/helm/sekai-viewer-reborn \
  --namespace viewer \
  --set apps.tools-site.enabled=false \
  --set apps.media-lab-site.enabled=false \
  --set apps.account-site.enabled=false \
  --set-string apps.content-site.env.SEKAI_MASTER_API_BASE_URL=https://master-api.example.com \
  --set-string apps.content-site.env.SEKAI_API_BASE_URL=https://api.example.com \
  --set-string apps.content-site.env.PUBLIC_REMOTE_ASSET_BASE_URL=https://assets.example.com
```

The chart uses TCP startup, liveness, and readiness probes against the named
`http` container port (3000). No HTTP health-check path is assumed.

The pod security context keeps `runAsNonRoot: true` and
`seccompProfile.type: RuntimeDefault`. Numeric `runAsUser` and `runAsGroup`
values are intentionally left unset because the application Dockerfiles use
`USER appuser` without pinning numeric IDs; the image-defined non-root user is
used until the Dockerfiles pin those IDs.

## Upgrade

For a safe upgrade, first update the operator-owned values file to the new
versioned immutable image tag and review the rendered diff or manifest. Then
upgrade the existing release and check both Helm and the Deployment rollout:

```bash
helm upgrade --install viewer deploy/helm/sekai-viewer-reborn \
  --namespace viewer \
  --values viewer-values.yaml \
  --atomic \
  --timeout 10m
helm status viewer --namespace viewer
kubectl rollout status deployment/viewer-sekai-viewer-reborn-content-site \
  --namespace viewer \
  --timeout=10m
```

Repeat the rollout check for each enabled application. `helm upgrade` uses the
chart defaults plus the supplied values file; use `--reuse-values` only when
you intentionally want to retain the release's previous values and have
reviewed the consequences of omitting newer defaults or operator changes.

To deploy only selected applications, disable the others through the values
file or explicit flags. Disabling an app causes Helm to remove that app's
resources from the release, so confirm the intended resource deletion before
upgrading. For example:

```bash
helm upgrade --install viewer deploy/helm/sekai-viewer-reborn \
  --namespace viewer \
  --create-namespace \
  --set apps.tools-site.enabled=false \
  --set apps.media-lab-site.enabled=false \
  --set apps.account-site.enabled=false
```

When using this targeted form for an existing release, include the complete
operator-owned values file as well, or use `--reuse-values` deliberately after
reviewing the resulting values.

The content site has four default environment keys. The three API and asset
URL values are empty and must be set by the operator; `PUBLIC_SEKAI_I18N_BASE_URL`
defaults to `https://sekai-world.github.io/sekai-i18n-reborn`. Values are quoted
when rendered, so an intentionally empty value remains an empty string. Other
applications have empty `env` maps by default. `envFrom` and `extraEnv` are
available per application for straightforward Secret/ConfigMap references and
additional environment entries.

Ingress hosts, ingress class, annotations, paths, and TLS settings are
configured independently under each application's `ingress` values. Set
`apps.<app-name>.ingress.enabled=false` to omit an application's Ingress. Set
`pdb.enabled=false` to omit PodDisruptionBudgets.

## Rollback

Inspect release history, select the revision to restore, and roll back with
readiness waiting enabled:

```bash
helm history viewer --namespace viewer
helm rollback viewer <REVISION> \
  --namespace viewer \
  --wait \
  --timeout 10m
helm status viewer --namespace viewer
kubectl rollout status deployment/viewer-sekai-viewer-reborn-content-site \
  --namespace viewer \
  --timeout=10m
```

`--atomic` waits for the upgrade and automatically rolls the release back if it
fails; `--timeout` bounds that wait. Use the revision shown by `helm history`
(not an image tag) and repeat the
rollout check for each enabled application after the rollback.
