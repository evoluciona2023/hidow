import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // Build as an IIFE bundle embeddable via <script> tag
    lib: {
      entry: "src/main.jsx",
      name: "HiDowWidget",
      fileName: "hidow-widget",
      formats: ["iife"],
    },
    rollupOptions: {
      // Bundle React inside — no external deps needed on the page
      external: [],
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "development"),
  },
});
