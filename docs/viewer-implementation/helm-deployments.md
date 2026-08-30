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
`docker.dnaroma.eu/sekai-viewer-reborn/<app-name>`, and every app uses the
explicit default tag `0.0.0`. Images are published by the `Docker Publish`
workflow (`.github/workflows/docker-publish.yml`), which builds each app image
when a release tag `@apps/<app-name>@<version>` is pushed and pushes both the
version tag and a `sha-<commit>` tag to the registry. Repository, tag, and pull
policy remain configurable per app. Deployments
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

## Application environment configuration

`apps.content-site.env` contains these default keys:

- `SEKAI_MASTER_API_BASE_URL`: empty and operator-supplied
- `SEKAI_API_BASE_URL`: empty and operator-supplied
- `PUBLIC_REMOTE_ASSET_BASE_URL`: empty and operator-supplied
- `PUBLIC_SEKAI_I18N_BASE_URL`: defaults to
  `https://sekai-world.github.io/sekai-i18n-reborn`

Every app (`content-site`, `tools-site`, `media-lab-site`, `account-site`)
declares an empty `SEKAI_API_BASE_URL` default for server-side dynamic
notifications; the three non-content apps provide only that key by default
(`env` maps are otherwise empty). `envFrom` and `extraEnv` can be set per app
for simple Secret/ConfigMap references and additional environment entries.
Environment map values are rendered as quoted strings, including empty strings.

## Confirmed workflow

From the repository root, validate the chart and render a release that exposes
`SEKAI_API_BASE_URL` for every enabled application:

```bash
helm lint deploy/helm/sekai-viewer-reborn
helm template viewer deploy/helm/sekai-viewer-reborn \
  --namespace viewer \
  --set-string apps.content-site.env.SEKAI_MASTER_API_BASE_URL=https://master-api.example.com \
  --set-string apps.content-site.env.SEKAI_API_BASE_URL=https://api.example.com \
  --set-string apps.content-site.env.PUBLIC_REMOTE_ASSET_BASE_URL=https://assets.example.com \
  --set-string apps.tools-site.env.SEKAI_API_BASE_URL=https://api.example.com \
  --set-string apps.media-lab-site.env.SEKAI_API_BASE_URL=https://api.example.com \
  --set-string apps.account-site.env.SEKAI_API_BASE_URL=https://api.example.com
```

Install or upgrade a release with an explicitly selected namespace:

```bash
helm upgrade --install viewer deploy/helm/sekai-viewer-reborn \
  --namespace viewer \
  --create-namespace \
  --set-string apps.content-site.env.SEKAI_MASTER_API_BASE_URL=https://master-api.example.com \
  --set-string apps.content-site.env.SEKAI_API_BASE_URL=https://api.example.com \
  --set-string apps.content-site.env.PUBLIC_REMOTE_ASSET_BASE_URL=https://assets.example.com \
  --set-string apps.tools-site.env.SEKAI_API_BASE_URL=https://api.example.com \
  --set-string apps.media-lab-site.env.SEKAI_API_BASE_URL=https://api.example.com \
  --set-string apps.account-site.env.SEKAI_API_BASE_URL=https://api.example.com
```

Use `--set apps.<app-name>.enabled=false` for an app that should not be
deployed. The chart does not create a Namespace, so select or create the
release namespace with `--namespace` and `--create-namespace`. Use
`helm history viewer --namespace viewer` followed by
`helm rollback viewer <REVISION> --namespace viewer` to roll back a release.

The canonical operator workflow is documented in the chart README: copy
`values.yaml` to an operator-owned file, replace image/Ingress/TLS
placeholders, set the required URLs (`SEKAI_API_BASE_URL` for every app, plus
the content-site-only `SEKAI_MASTER_API_BASE_URL` and
`PUBLIC_REMOTE_ASSET_BASE_URL`), lint and render before
applying, and use `helm upgrade --install --atomic --timeout` for installation
and upgrades. `--atomic` waits and automatically rolls back a failed install or
upgrade. Use immutable versioned image tags, check `helm status` and `kubectl
rollout status`, and use `helm rollback --wait --timeout` after selecting a
revision from `helm history`. Disabling an app removes its Helm-managed
resources, and `--reuse-values` should only be used deliberately.

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
