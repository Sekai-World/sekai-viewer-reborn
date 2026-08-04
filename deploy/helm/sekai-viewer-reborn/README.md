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

## Install or upgrade

Install all four applications into a release namespace, creating that
namespace outside the chart when necessary:

```bash
helm upgrade --install viewer deploy/helm/sekai-viewer-reborn \
  --namespace viewer \
  --create-namespace \
  --set-string apps.content-site.env.SEKAI_MASTER_API_BASE_URL=https://master-api.example.com \
  --set-string apps.content-site.env.SEKAI_API_BASE_URL=https://api.example.com \
  --set-string apps.content-site.env.PUBLIC_REMOTE_ASSET_BASE_URL=https://assets.example.com
```

To deploy only selected applications, disable the others through values. For
example:

```bash
helm upgrade --install viewer deploy/helm/sekai-viewer-reborn \
  --namespace viewer \
  --create-namespace \
  --set apps.tools-site.enabled=false \
  --set apps.media-lab-site.enabled=false \
  --set apps.account-site.enabled=false
```

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

Inspect release history and roll back to a previous revision with Helm:

```bash
helm history viewer --namespace viewer
helm rollback viewer <REVISION> --namespace viewer
```
