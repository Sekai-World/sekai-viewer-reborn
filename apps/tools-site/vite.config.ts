import { defineConfig, loadEnv } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyPath = env.VITE_REMOTE_ASSET_PROXY_PATH;
  const proxyTarget = env.VITE_REMOTE_ASSET_PROXY_TARGET;
  const enableProxy = mode === "development" && env.VITE_REMOTE_ASSET_PROXY_ENABLED === "true";

  if (enableProxy && (!proxyPath || !proxyTarget)) {
    throw new Error("Asset proxy path and target are required when the asset proxy is enabled.");
  }

  return {
    plugins: [sveltekit(), tailwindcss()],
    server: {
      host: "0.0.0.0",
      ...(enableProxy
        ? {
            proxy: {
              [proxyPath as string]: {
                target: proxyTarget,
                changeOrigin: true,
                secure: true,
                rewrite: (path: string) =>
                  path.startsWith(proxyPath as string)
                    ? path.slice((proxyPath as string).length) || "/"
                    : path,
                configure: (proxy) => {
                  proxy.on("proxyReq", (proxyReq) => {
                    proxyReq.removeHeader("origin");
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
