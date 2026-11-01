import adapter from "@sveltejs/adapter-node";
import { defineConfig, loadEnv } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyPath = env.VITE_REMOTE_ASSET_PROXY_PATH;
  const proxyTarget = env.VITE_REMOTE_ASSET_PROXY_TARGET;
  const enableProxy = mode === "development" && env.VITE_REMOTE_ASSET_PROXY_ENABLED === "true";
  const devHost = env.VITE_DEV_HOST || "127.0.0.1";
  const devAllowedHosts = (env.VITE_DEV_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);

  if (enableProxy && (!proxyPath || !proxyTarget)) {
    throw new Error(
      "VITE_REMOTE_ASSET_PROXY_PATH and VITE_REMOTE_ASSET_PROXY_TARGET are required when VITE_REMOTE_ASSET_PROXY_ENABLED=true."
    );
  }

  return {
    plugins: [
      sveltekit({
        adapter: adapter(),
        // Check `_app/version.json` for a new deployment every 10 minutes, in addition to
        // SvelteKit's checks on focus, visibility, and data responses. The build name
        // (`version.name`) keeps SvelteKit's per-build timestamp default.
        version: { pollInterval: 600_000 }
      }),
      tailwindcss()
    ],
    server: {
      host: devHost,
      strictPort: true,
      ...(devAllowedHosts.length > 0 ? { allowedHosts: devAllowedHosts } : {}),
      ...(enableProxy
        ? {
            proxy: {
              [proxyPath as string]: {
                target: proxyTarget,
                changeOrigin: true,
                secure: true,
                rewrite: (path) => path.replace(new RegExp(`^${proxyPath as string}`), ""),
                configure: (proxy) => {
                  proxy.on("proxyReq", (proxyReq) => {
                    // Remove 'Origin' header to prevent CORS issues
                    proxyReq.removeHeader("origin");
                    // Remove 'Referer' header to prevent potential issues with some servers
                    proxyReq.removeHeader("referer");
                  });
                }
              }
            }
          }
        : {})
    }
  };
});
