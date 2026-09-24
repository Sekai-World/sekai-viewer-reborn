import { defineConfig, loadEnv } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";

// Mirrors the content-site dev asset proxy: with the env switch enabled,
// remote story assets are served same-origin through `<path> -> <target>`
// instead of hitting the public bucket with browser CORS requests.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyPath = env.VITE_REMOTE_ASSET_PROXY_PATH;
  const proxyTarget = env.VITE_REMOTE_ASSET_PROXY_TARGET;
  const enableProxy = mode === "development" && env.VITE_REMOTE_ASSET_PROXY_ENABLED === "true";
  const devHost = env.VITE_DEV_HOST || "localhost";
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
    plugins: [sveltekit(), tailwindcss()],
    server: {
      host: devHost,
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
