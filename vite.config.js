// vite.config.js
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ""); // loads .env.*, incl .env.local

  return {
    plugins: [react()],
    server: {
      port: 3002,
      proxy: {
        "/cms": {
          target: "https://data.medicare.gov", // ⬅️ Medicare SODA host
          changeOrigin: true, // set Host to target
          secure: true,
          // /cms/xubh-q36u.json → /resource/xubh-q36u.json
          rewrite: (p) => p.replace(/^\/cms/, "/resource"),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq, req) => {
              // helpful logs
              // console.log("→ proxy", req.method, req.url);
              // Prefer header-only token
              if (env.VITE_CMS_APP_TOKEN) {
                proxyReq.setHeader("X-App-Token", env.VITE_CMS_APP_TOKEN);
              }
              proxyReq.setHeader("Accept", "application/json");
              // avoid origin-based blocks in dev
              try {
                proxyReq.removeHeader?.("origin");
              } catch {}
            });
            proxy.on("proxyRes", (proxyRes, req) => {
              // console.log("←", proxyRes.statusCode, req.url);
            });
            proxy.on("error", (err, req) => {
              console.error("Proxy error:", err?.message, req?.url);
            });
          },
        },
      },
    },
  };
});
