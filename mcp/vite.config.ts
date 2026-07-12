import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./web"),
    },
  },
  build: {
    outDir: "dist/web",
    emptyOutDir: true,
    rollupOptions: {
      input: "index.html",
    },
  },
});
