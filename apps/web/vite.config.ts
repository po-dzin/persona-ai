import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: parseInt(process.env.PORT || "3000"),
    host: true,
    proxy: {
      // Forward API calls to local backend during development
      "/v1": "http://localhost:8000",
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    globals: true,
    css: true,
  },
});
