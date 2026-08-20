# Container Instructions

The repository builds SvelteKit applications with the app Dockerfiles under
`apps/*/Dockerfile` and runs local dependencies through the compose files under
`deploy/compose`. Check the relevant Dockerfile, compose configuration, and
README before changing container behavior; these instructions supplement the
actual runtime contract rather than replacing it.

## Dockerfiles

- Use multi-stage builds when build-time dependencies are not needed at runtime.
- Keep the build context at the repository root when using the current app
  Dockerfiles, and preserve the workspace-aware `pnpm` build commands.
- Use the repository's Node.js 24 Alpine base and pinned package-manager version
  unless a documented runtime requirement justifies a change.
- Copy dependency manifests before source files where that improves build-cache
  reuse. Do not copy secrets, local `.env` files, `.git`, host `node_modules`, or
  unrelated build output into an image.
- Keep runtime images limited to the artifacts and dependencies required by the
  app. Do not hand-edit generated build output to work around an image build.
- Use runtime environment variables for deployment-specific configuration; never
  bake credentials or tokens into an image.

## Compose and local dependencies

- Keep compose commands idempotent and recoverable when run repeatedly.
- Preserve the repository's host-container-engine and Docker API compatibility
  when changing local dependency orchestration.
- Validate the affected compose workflow with the documented `mise` tasks when
  the environment supports them, and avoid stopping unrelated managed services.

## Validation

- Build the affected image from the repository root using its existing Dockerfile
  command and inspect the resulting runtime command and exposed port.
- Run the smallest relevant application checks before a full image build.
- For compose changes, validate both startup and teardown using the project's
  documented commands.
- Treat image scanning, base-image updates, and runtime hardening as deployment
  concerns to verify against the target environment rather than blindly copying
  generic settings.
