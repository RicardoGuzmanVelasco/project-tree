import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/tasks": "http://localhost:3001",
      "/plans": "http://localhost:3001",
      "/events": "http://localhost:3001",
    },
  },
});
