import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 7891,
    proxy: {
      "/api": "http://localhost:7890",
      "/sync": {
        ws: true,
        target: "ws://localhost:7890",
      },
    },
  },
});
