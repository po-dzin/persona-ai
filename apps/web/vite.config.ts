import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 3000,
    host: true,
    proxy: {
      // Forward API calls to local backend during development
      "/v1": "http://localhost:8000",
    },
  },
});
