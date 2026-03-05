import { defineConfig, loadEnv } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyPath = env.VITE_REMOTE_ASSET_PROXY_PATH || "/storage";
  const proxyTarget = env.VITE_REMOTE_ASSET_PROXY_TARGET || "https://storage.sekai.best";
  const enableProxy = mode === "development" && env.VITE_REMOTE_ASSET_PROXY_ENABLED !== "false";

  return {
    plugins: [sveltekit(), tailwindcss()],
    server: enableProxy
      ? {
          proxy: {
            [proxyPath]: {
              target: proxyTarget,
              changeOrigin: true,
              secure: true,
              rewrite: (path) => path.replace(new RegExp(`^${proxyPath}`), ""),
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
      : undefined
  };
});
