import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    server: {
      port: 3002,
      proxy: {
        "/cms": {
          target: "https://data.medicare.gov", //Medicare SODA host
          changeOrigin: true,
          secure: true,

          rewrite: (p) => p.replace(/^\/cms/, "/resource"),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq, req) => {
              if (env.VITE_CMS_APP_TOKEN) {
                proxyReq.setHeader("X-App-Token", env.VITE_CMS_APP_TOKEN);
              }
              proxyReq.setHeader("Accept", "application/json");

              try {
                proxyReq.removeHeader?.("origin");
              } catch {}
            });
            proxy.on("proxyRes", (proxyRes, req) => {});
            proxy.on("error", (err, req) => {
              console.error("Proxy error:", err?.message, req?.url);
            });
          },
        },
      },
    },
  };
});
