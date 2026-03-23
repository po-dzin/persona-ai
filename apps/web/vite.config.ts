import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5174,
    proxy: {
      // Forward API calls to local backend during development
      "/v1": "http://localhost:8000",
    },
  },
});
