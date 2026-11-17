import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { artPlugin } from "./art-plugin.js";

const apiTarget = process.env.API_PROXY_TARGET ?? "http://localhost:3001";

export default defineConfig({
  plugins: [react(), tailwindcss(), artPlugin()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: apiTarget, ws: true },
    },
  },
});
