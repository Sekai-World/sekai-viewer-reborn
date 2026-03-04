# Independent Ingress Pattern

Use one namespace and one ingress per app when deploying independently:

- `deploy/k8s/content-site/ingress.yaml`
- `deploy/k8s/tools-site/ingress.yaml`
- `deploy/k8s/media-lab-site/ingress.yaml`
- `deploy/k8s/account-site/ingress.yaml`

Apply per app:

```bash
kubectl create namespace content-site
kubectl apply -f deploy/k8s/content-site/
```

Repeat for each app namespace.
