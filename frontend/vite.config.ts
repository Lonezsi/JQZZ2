import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const BACKEND = process.env.JQZZ_BACKEND_URL || "http://127.0.0.1:8080";

// The app calls the API with relative paths; in dev Vite forwards them to the
// backend (nginx does the same in Docker), so no CORS or host config is needed.
const proxied = ["/quizzes", "/users", "/lobbies", "/game", "/images"];

// https://vite.dev/config/
export default defineConfig({
  define: {
    global: "globalThis",
  },
  plugins: [react()],
  server: {
    proxy: {
      ...Object.fromEntries(proxied.map((path) => [path, BACKEND])),
      "/ws": { target: BACKEND, ws: true },
    },
  },
});
