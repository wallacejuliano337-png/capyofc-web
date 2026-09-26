import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
export default defineConfig({
  base: "./",
  plugins: [react(), tailwind()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    // Electron session files are locked while running and are not source files.
    watch: {
      ignored: [
        "**/.cache/**",
        "**/release/**",
        "**/test-results/**",
        "**/dist-electron/**",
      ],
    },
  },
  build: { sourcemap: false },
});
