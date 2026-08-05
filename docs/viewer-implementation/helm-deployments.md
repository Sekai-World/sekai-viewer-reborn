# Helm deployments

## Confirmed chart layout

The repository contains one application chart at
`deploy/helm/sekai-viewer-reborn`. It renders resources for these values keys:

- `apps.content-site`
- `apps.tools-site`
- `apps.media-lab-site`
- `apps.account-site`

Each app is enabled by default. For an enabled app, the chart renders a
Deployment, a ClusterIP Service exposing port 80 to container port 3000, and
an Ingress by default. PodDisruptionBudgets are enabled by default through
`pdb.enabled`. The chart intentionally does not render a Namespace; the Helm
release namespace is supplied by the command line.

The default image repositories are
`ghcr.io/sekai-world/<app-name>`, and every app uses the explicit default tag
`0.0.0`. Repository, tag, and pull policy are configurable per app. Deployments
default to two replicas, a rolling update with `maxUnavailable: 0` and
`maxSurge: 1`, resource requests of `100m` CPU and `128Mi` memory, and limits of
`500m` CPU and `512Mi` memory.

The pod security defaults set `runAsNonRoot` and `RuntimeDefault` seccomp.
Numeric `runAsUser` and `runAsGroup` values are intentionally left unset
because the application Dockerfiles use `USER appuser` without pinning numeric
IDs; the image-defined non-root user is used until the Dockerfiles pin those
IDs. Containers disallow privilege escalation and drop all Linux capabilities.
`readOnlyRootFilesystem` is not enabled by default because no writable-runtime
assessment or tmpfs configuration has been established. Default preferred pod
anti-affinity spreads replicas of each app by substituting the current app name
for the reserved `__APP_NAME__` affinity value. Empty tolerations and an empty
node selector are provided in `values.yaml`.

The startup, liveness, and readiness probes are TCP probes against the named
`http` port, which is container port 3000. The chart does not assume an HTTP
health endpoint.

## Content-site configuration

`apps.content-site.env` contains these default keys:

- `SEKAI_MASTER_API_BASE_URL`: empty and operator-supplied
- `SEKAI_API_BASE_URL`: empty and operator-supplied
- `PUBLIC_REMOTE_ASSET_BASE_URL`: empty and operator-supplied
- `PUBLIC_SEKAI_I18N_BASE_URL`: defaults to
  `https://sekai-world.github.io/sekai-i18n-reborn`

The other app `env` maps are empty by default. `envFrom` and `extraEnv` can be
set per app for simple Secret/ConfigMap references and additional environment
entries. Environment map values are rendered as quoted strings, including
empty strings.

## Confirmed workflow

From the repository root, validate the chart and render a content-site-only
release:

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

Install or upgrade a release with an explicitly selected namespace:

```bash
helm upgrade --install viewer deploy/helm/sekai-viewer-reborn \
  --namespace viewer \
  --create-namespace \
  --set-string apps.content-site.env.SEKAI_MASTER_API_BASE_URL=https://master-api.example.com \
  --set-string apps.content-site.env.SEKAI_API_BASE_URL=https://api.example.com \
  --set-string apps.content-site.env.PUBLIC_REMOTE_ASSET_BASE_URL=https://assets.example.com
```

Use `--set apps.<app-name>.enabled=false` for an app that should not be
deployed. The chart does not create a Namespace, so select or create the
release namespace with `--namespace` and `--create-namespace`. Use
`helm history viewer --namespace viewer` followed by
`helm rollback viewer <REVISION> --namespace viewer` to roll back a release.

The canonical operator workflow is documented in the chart README: copy
`values.yaml` to an operator-owned file, replace image/Ingress/TLS
placeholders, set the required content-site URLs, lint and render before
applying, and use `helm upgrade --install --wait --timeout` for installation
and upgrades. Use immutable versioned image tags, check `helm status` and
`kubectl rollout status`, and use `helm rollback --wait --timeout` after
selecting a revision from `helm history`. Disabling an app removes its Helm-
managed resources, and `--reuse-values` should only be used deliberately.

## Source references

- `deploy/helm/sekai-viewer-reborn/values.yaml` — chart defaults and app values.
- `deploy/helm/sekai-viewer-reborn/templates/deployment.yaml` — deployment,
  security, resources, scheduling, environment, and TCP probe rendering.
- `deploy/helm/sekai-viewer-reborn/templates/service.yaml` — ClusterIP service
  port mapping.
- `deploy/helm/sekai-viewer-reborn/templates/ingress.yaml` — per-app host and
  TLS rendering.
- `apps/*/Dockerfile` — each app's Node runtime listens on port 3000 and runs
  as a non-root `appuser`.
