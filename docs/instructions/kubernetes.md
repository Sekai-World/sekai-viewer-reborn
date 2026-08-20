# Kubernetes and Helm Instructions

This repository deploys its applications through
`deploy/helm/sekai-viewer-reborn`. Read that chart and its README before changing
deployment behavior. Verify assumptions against the target cluster and deployment
requirements; this document does not impose configuration that the chart or
target platform does not support.

## Required checks for chart changes

- Keep Helm template labels, selectors, service ports, and container ports
  consistent. Do not change an app's exposure model or ingress/TLS values without
  confirming the corresponding chart values and deployment target.
- Do not put credentials, tokens, or private keys in chart values, ConfigMaps,
  rendered manifests, or image layers. Use the target platform's approved secret
  injection mechanism.
- Render and review the affected chart before deployment. At minimum run:

  ```bash
  helm template release-name deploy/helm/sekai-viewer-reborn
  ```

  Also run the chart's documented validation commands and cluster-side dry runs
  when the target environment and credentials permit them.

## Recommended safeguards

- Configure resource requests and limits, probes, and rolling-update settings
  only when they match the application behavior and target-cluster policy.
- Prefer non-root containers, disabled privilege escalation, dropped unnecessary
  capabilities, and a read-only filesystem where the image and runtime support
  them.
- Use versioned images rather than mutable production tags. Keep application logs
  on standard output/error for the deployment platform to collect.
- For availability-sensitive workloads, evaluate replicas, disruption handling,
  and rollout settings with the deployment owner rather than copying generic
  values into the chart.

## Operational verification

- After an approved deployment, use the target's normal tooling to inspect
  rollout status, pod readiness, service endpoints, ingress routing, and logs.
- Keep a rollback path to a previously known image/chart revision, and confirm it
  with the deployment owner before changing rollout strategy.
